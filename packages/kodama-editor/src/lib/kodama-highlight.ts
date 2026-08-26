import Highlight from "@tiptap/extension-highlight";

import { markdownItHighlight } from "./markdown-it-highlight";

/** Highlight mark with `==text==` markdown round-trip via tiptap-markdown. */
export const KodamaHighlight = Highlight.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "==",
          close: "==",
          expelEnclosingWhitespace: true,
        },
        parse: {
          setup(markdownit: { use: (plugin: unknown) => void }) {
            markdownit.use(markdownItHighlight);
          },
        },
      },
    };
  },
});
