import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { KodamaLink } from "@/lib/kodama-link";

function createEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, bulletList: false }),
      KodamaLink,
      Markdown.configure({ html: false, linkify: true, breaks: true }),
    ],
    content,
  });
}

describe("editor links", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("linkifies bare URLs in markdown content", () => {
    editor = createEditor("See https://example.com for details.");
    let hasLink = false;
    editor.state.doc.descendants((node) => {
      if (node.isText && node.marks.some((mark) => mark.type.name === "link")) {
        hasLink = true;
      }
    });
    expect(hasLink).toBe(true);
  });

  it("parses markdown link syntax on load", () => {
    editor = createEditor('[Kodama](https://kodama.page "Forest home")');
    let href = "";
    let title: string | null = null;
    editor.state.doc.descendants((node) => {
      node.marks.forEach((mark) => {
        if (mark.type.name === "link") {
          href = mark.attrs.href as string;
          title = (mark.attrs.title as string | null) ?? null;
        }
      });
    });
    expect(href).toMatch(/^https:\/\/kodama\.page\/?$/);
    expect(title).toBe("Forest home");
  });
});
