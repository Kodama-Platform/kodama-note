import "tiptap-markdown";

declare module "@tiptap/core" {
  interface Storage {
    markdown: {
      parser: {
        parse: (content: string, options?: { inline?: boolean }) => string;
      };
      getMarkdown: () => string;
    };
  }
}
