import { Extension, markInputRule } from "@tiptap/core";

import { SAFE_INLINE_HTML_TAGS } from "./kodama-html-passthrough";
import { markdownItHtmlMark } from "./markdown-it-html-mark";
import { markdownItSafeBlocks } from "./markdown-it-safe-blocks";

/** Whitelisted inline tag → mark name in the Kodama schema. */
const INLINE_TAG_MARKS: Record<string, string> = {
  b: "bold",
  strong: "bold",
  i: "italic",
  em: "italic",
  s: "strike",
  del: "strike",
  mark: "highlight",
  code: "code",
  u: "underline",
  sub: "subscript",
  sup: "superscript",
};

/**
 * Registers markdown-it rules for Kodama styled paragraph/heading HTML plus the
 * whitelisted inline tags, and input rules so the same tags typed by hand turn
 * into real marks. Non-whitelisted HTML is left as literal text and round-trips
 * verbatim (see `KodamaText`).
 */
export const KodamaMarkdownHtml = Extension.create({
  name: "kodamaMarkdownHtml",

  addStorage() {
    return {
      markdown: {
        parse: {
          setup(markdownit: { use: (plugin: unknown) => void }) {
            markdownit.use(markdownItSafeBlocks);
            for (const tag of SAFE_INLINE_HTML_TAGS) {
              markdownit.use(markdownItHtmlMark(tag));
            }
          },
        },
      },
    };
  },

  addInputRules() {
    return Object.entries(INLINE_TAG_MARKS).flatMap(([tag, markName]) => {
      const type = this.editor.schema.marks[markName];
      if (!type) return [];
      return [
        markInputRule({
          find: new RegExp(`<${tag}>([^<>]+)</${tag}>$`, "i"),
          type,
        }),
      ];
    });
  },
});
