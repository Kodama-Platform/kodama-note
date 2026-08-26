import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";

import { markdownItHtmlMark } from "./markdown-it-html-mark";

function htmlMarkStorage(tag: string) {
  return {
    markdown: {
      serialize: {
        open: `<${tag}>`,
        close: `</${tag}>`,
        expelEnclosingWhitespace: true,
      },
      parse: {
        setup(markdownit: { use: (plugin: unknown) => void }) {
          markdownit.use(markdownItHtmlMark(tag));
        },
      },
    },
  };
}

export const KodamaUnderline = Underline.extend({
  addStorage() {
    return htmlMarkStorage("u");
  },
});

export const KodamaSubscript = Subscript.extend({
  addStorage() {
    return htmlMarkStorage("sub");
  },
});

export const KodamaSuperscript = Superscript.extend({
  addStorage() {
    return htmlMarkStorage("sup");
  },
});
