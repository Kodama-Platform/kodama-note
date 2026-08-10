type MarkdownItLike = {
  inline: {
    ruler: {
      before: (beforeName: string, ruleName: string, fn: (state: InlineState, silent: boolean) => boolean) => void;
    };
  };
  renderer: {
    rules: Record<string, () => string>;
  };
};

type Token = {
  markup: string;
};

type InlineState = {
  src: string;
  pos: number;
  posMax: number;
  push: (type: string, tag: string, nesting: number) => Token;
  md: {
    inline: {
      tokenize: (state: InlineState) => void;
    };
  };
};

/** Inline `<tag>…</tag>` → TipTap mark (safe whitelist; works with markdown-it `html: false`). */
export function markdownItHtmlMark(tag: string) {
  const openType = `${tag}_open`;
  const closeType = `${tag}_close`;
  const openRe = new RegExp(`^<${tag}>`, "i");
  const closeToken = `</${tag}>`;

  return (md: MarkdownItLike) => {
    md.inline.ruler.before("emphasis", `html_mark_${tag}`, (state, silent) => {
      const start = state.pos;
      if (!openRe.test(state.src.slice(start))) return false;

      const contentStart = start + tag.length + 2;
      const closeIdx = state.src.toLowerCase().indexOf(closeToken, contentStart);
      if (closeIdx < 0 || closeIdx > state.posMax) return false;
      if (closeIdx === contentStart) return false;

      if (silent) return true;

      const tokenOpen = state.push(openType, tag, 1);
      tokenOpen.markup = `<${tag}>`;

      const savedPosMax = state.posMax;
      state.pos = contentStart;
      state.posMax = closeIdx;
      state.md.inline.tokenize(state);
      state.pos = closeIdx + closeToken.length;
      state.posMax = savedPosMax;

      const tokenClose = state.push(closeType, tag, -1);
      tokenClose.markup = closeToken;
      return true;
    });

    md.renderer.rules[openType] = () => `<${tag}>`;
    md.renderer.rules[closeType] = () => `</${tag}>`;
  };
}
