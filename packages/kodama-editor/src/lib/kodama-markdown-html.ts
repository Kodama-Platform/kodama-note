import { Extension } from "@tiptap/core";

import { markdownItSafeBlocks } from "./markdown-it-safe-blocks";

/** Registers markdown-it block rules for Kodama styled paragraph/heading HTML. */
export const KodamaMarkdownHtml = Extension.create({
  name: "kodamaMarkdownHtml",
  addStorage() {
    return {
      markdown: {
        parse: {
          setup(markdownit: { use: (plugin: unknown) => void }) {
            markdownit.use(markdownItSafeBlocks);
          },
        },
      },
    };
  },
});
