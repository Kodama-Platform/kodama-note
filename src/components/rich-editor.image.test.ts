import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { createKodamaExtensions } from "@kodama.page/editor";

describe("inline image insert", () => {
  let editor: Editor | null = null;
  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("serializes a pasted attachment image as markdown", () => {
    editor = new Editor({
      extensions: createKodamaExtensions({ includeChrome: false }),
      content: "",
    });
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: { src: "kodama-att:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", alt: "Trail" },
      })
      .run();
    expect(editor.storage.markdown.getMarkdown()).toContain(
      "![Trail](kodama-att:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa)",
    );
  });

  it("parses markdown image syntax", () => {
    editor = new Editor({
      extensions: createKodamaExtensions({ includeChrome: false }),
      content: "![map](https://example.com/map.png)",
    });
    const image = editor.getJSON().content?.find((n) => n.type === "image");
    expect(image?.attrs?.src).toBe("https://example.com/map.png");
  });
});
