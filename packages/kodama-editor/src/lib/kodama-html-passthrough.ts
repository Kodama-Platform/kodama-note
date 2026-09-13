/**
 * Raw-HTML policy (GitHub / VS Code-ish):
 * - Known-safe inline tags become real marks.
 * - Known-safe styled block tags become real blocks (`markdownItSafeBlocks`).
 * - Anything else stays literal text and round-trips verbatim — no `&lt;` on export.
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

/**
 * Text node that serializes verbatim.
 * tiptap-markdown's default escapes `<`/`>` into HTML entities, which turns
 * typed `<div>x</div>` into `&lt;div&gt;x&lt;/div&gt;` on export.
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
