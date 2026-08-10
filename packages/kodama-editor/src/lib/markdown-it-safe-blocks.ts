type Token = {
  type: string;
  tag: string;
  nesting: number;
  attrs: [string, string][] | null;
  map: [number, number] | null;
  markup: string;
  content: string;
  children: Token[] | null;
};

type BlockState = {
  src: string;
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  sCount: number[];
  blkIndent: number;
  line: number;
  parentType: string;
  push: (type: string, tag: string, nesting: number) => Token;
  md: {
    inline: {
      parse: (src: string, env: unknown, tokens: Token[]) => void;
    };
  };
  env: unknown;
};

const OPEN_RE =
  /^<(p|h([1-3]))(?:\s+([^>]*))?>((?:(?!<\/(?:p|h[1-3])>).)*)<\/(?:p|h[1-3])>\s*$/i;

function parseAttrs(raw: string | undefined): { align?: string; indent?: number } {
  if (!raw) return {};
  const align = /text-align:\s*(left|center|right)/i.exec(raw)?.[1]?.toLowerCase();
  const indentRaw = /data-indent\s*=\s*["']?(\d+)/i.exec(raw)?.[1];
  const indent = indentRaw ? Number(indentRaw) : undefined;
  return {
    align: align === "left" || align === "center" || align === "right" ? align : undefined,
    indent: Number.isFinite(indent) ? indent : undefined,
  };
}

/**
 * Parse single-line safe styled blocks emitted by Kodama serializers:
 * `<p style="text-align: center" data-indent="1">…</p>`
 * `<h2 style="text-align: right">…</h2>`
 */
export function markdownItSafeBlocks(md: {
  block: {
    ruler: {
      before: (
        beforeName: string,
        ruleName: string,
        fn: (state: BlockState, startLine: number, endLine: number, silent: boolean) => boolean,
      ) => void;
    };
  };
}): void {
  md.block.ruler.before("paragraph", "kodama_safe_block", (state, startLine, _endLine, silent) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false;

    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(pos, max);
    const match = OPEN_RE.exec(line);
    if (!match) return false;

    if (silent) return true;

    const tag = match[1].toLowerCase();
    const level = match[2] ? Number(match[2]) : undefined;
    const attrs = parseAttrs(match[3]);
    const content = match[4] ?? "";

    const tokenOpen = state.push(tag === "p" ? "paragraph_open" : "heading_open", tag, 1);
    tokenOpen.map = [startLine, startLine + 1];
    tokenOpen.attrs = [];
    if (attrs.align) {
      tokenOpen.attrs.push(["style", `text-align: ${attrs.align}`]);
    }
    if (attrs.indent && attrs.indent > 0) {
      tokenOpen.attrs.push(["data-indent", String(attrs.indent)]);
      const pad = `padding-left: ${attrs.indent * 1.5}em`;
      const existing = tokenOpen.attrs.find((a) => a[0] === "style");
      if (existing) existing[1] = `${existing[1]}; ${pad}`;
      else tokenOpen.attrs.push(["style", pad]);
    }
    if (tag.startsWith("h") && level) {
      tokenOpen.markup = "#".repeat(level);
      tokenOpen.attrs.push(["level", String(level)]);
    }

    const inline = state.push("inline", "", 0);
    inline.content = content;
    inline.map = [startLine, startLine + 1];
    inline.children = [];
    state.md.inline.parse(content, state.env, inline.children);

    state.push(tag === "p" ? "paragraph_close" : "heading_close", tag, -1);
    state.line = startLine + 1;
    return true;
  });
}
