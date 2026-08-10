type MarkdownItLike = {
  inline: {
    ruler: {
      before: (beforeName: string, ruleName: string, fn: (state: InlineState, silent: boolean) => boolean) => void;
    };
  };
  renderer: {
    rules: Record<string, (tokens: Token[], idx: number) => string>;
  };
};

type Token = {
  type: string;
  tag: string;
  nesting: number;
  markup: string;
  content?: string;
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

/**
 * markdown-it plugin for `==highlighted==` → `<mark>`.
 * TipTap Highlight parses `<mark>` and we serialize back to `==…==`.
 */
export function markdownItHighlight(md: MarkdownItLike): void {
  md.inline.ruler.before("emphasis", "highlight", (state, silent) => {
    const start = state.pos;
    if (start + 4 > state.posMax) return false;
    if (state.src.slice(start, start + 2) !== "==") return false;

    let end = start + 2;
    while (end < state.posMax - 1) {
      if (state.src.slice(end, end + 2) === "==") break;
      end += 1;
    }
    if (end >= state.posMax - 1) return false;
    if (end === start + 2) return false;

    if (silent) return true;

    const tokenOpen = state.push("highlight_open", "mark", 1);
    tokenOpen.markup = "==";

    const savedPosMax = state.posMax;
    state.pos = start + 2;
    state.posMax = end;
    state.md.inline.tokenize(state);
    state.pos = end + 2;
    state.posMax = savedPosMax;

    const tokenClose = state.push("highlight_close", "mark", -1);
    tokenClose.markup = "==";
    return true;
  });

  md.renderer.rules.highlight_open = () => "<mark>";
  md.renderer.rules.highlight_close = () => "</mark>";
}
