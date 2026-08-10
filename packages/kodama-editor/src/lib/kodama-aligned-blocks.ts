import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";

type Align = "left" | "center" | "right";

function isAlign(value: unknown): value is Align {
  return value === "left" || value === "center" || value === "right";
}

function clampIndent(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(8, Math.floor(n));
}

type SerializeState = {
  write: (text: string) => void;
  renderInline: (node: unknown) => void;
  closeBlock: (node: unknown) => void;
  ensureNewLine: () => void;
};

type AttrNode = {
  attrs: {
    textAlign?: string | null;
    indent?: number | null;
    level?: number;
  };
  content?: unknown;
};

function serializeBlock(
  state: SerializeState,
  node: AttrNode,
  tag: string,
  openMarkdownPrefix: string | null,
) {
  const align = isAlign(node.attrs.textAlign) ? node.attrs.textAlign : null;
  const indent = clampIndent(node.attrs.indent);
  const needsHtml = (align && align !== "left") || indent > 0;

  if (!needsHtml) {
    if (openMarkdownPrefix) state.write(openMarkdownPrefix);
    state.renderInline(node);
    state.closeBlock(node);
    return;
  }

  const styles: string[] = [];
  if (align && align !== "left") styles.push(`text-align: ${align}`);
  if (indent > 0) styles.push(`padding-left: ${indent * 1.5}em`);

  const attrs = [
    styles.length ? ` style="${styles.join("; ")}"` : "",
    indent > 0 ? ` data-indent="${indent}"` : "",
  ].join("");

  state.write(`<${tag}${attrs}>`);
  state.renderInline(node);
  state.write(`</${tag}>`);
  state.closeBlock(node);
}

/**
 * Paragraph/heading with text-align + indent that round-trip through markdown
 * as plain Markdown when default, or safe HTML tags when styled.
 */
export const KodamaParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializeState, node: AttrNode) {
          serializeBlock(state, node, "p", null);
        },
        parse: {},
      },
    };
  },
});

export const KodamaHeading = Heading.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializeState, node: AttrNode) {
          const level = node.attrs.level ?? 1;
          serializeBlock(state, node, `h${level}`, `${"#".repeat(level)} `);
        },
        parse: {},
      },
    };
  },
});
