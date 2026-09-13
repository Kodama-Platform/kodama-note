/**
 * Raw-HTML policy for Kodama notes (GitHub / VS Code-ish behaviour):
 *
 * - Known-safe inline tags (`<b>`, `<em>`, `<u>`, `<mark>`, …) become real marks.
 * - Known-safe styled block tags (`<p>`, `<h1>`–`<h3>`) become real blocks
 *   (handled by `markdownItSafeBlocks`).
 * - Anything else stays literal text and round-trips verbatim into markdown —
 *   no `&lt;div&gt;` entity mangling on export.
 */
import { Text } from "@tiptap/extension-text";

/** Inline tags that map onto marks already present in the schema. */
export const SAFE_INLINE_HTML_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "s",
  "del",
  "mark",
  "code",
] as const;

/** Heuristic: does this text contain an HTML-ish tag? */
export function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\w-]*(\s[^<>]*)?\/?>/i.test(text);
}

/**
 * Text node that serializes verbatim.
 * tiptap-markdown's default escapes `<`/`>` into HTML entities, which turns
 * typed `<div>x</div>` into `&lt;div&gt;x&lt;/div&gt;` on export.
 * Markdown-specific escaping (`*`, `_`, `[`, …) is still applied by the state.
 */
export const KodamaText = Text.extend({
  name: "text",
  addStorage() {
    return {
      markdown: {
        serialize(state: { text: (text: string) => void }, node: { text?: string }) {
          state.text(node.text ?? "");
        },
        parse: {},
      },
    };
  },
});
