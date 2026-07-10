import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { KodamaLink } from "@/lib/kodama-link";

function createEditor(content = "") {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, bulletList: false }),
      KodamaLink,
      Markdown.configure({ html: false, linkify: true, breaks: true }),
    ],
    content,
  });
}

function simulateTyping(editor: Editor, text: string) {
  editor.commands.focus("end");
  for (const char of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(editor.view, from, to, char),
    );
    if (!handled) {
      editor.view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  }
}

function selectText(editor: Editor, query: string) {
  let range: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (range || !node.isText || !node.text) return;
    const index = node.text.indexOf(query);
    if (index !== -1) {
      range = { from: pos + index, to: pos + index + query.length };
    }
  });
  if (range) editor.commands.setTextSelection(range);
}

function getFirstLink(editor: Editor) {
  let label = "";
  let href = "";
  let title: string | null = null;
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    node.marks.forEach((mark) => {
      if (mark.type.name === "link") {
        label = node.text ?? label;
        href = mark.attrs.href as string;
        title = (mark.attrs.title as string | null) ?? null;
      }
    });
  });
  return { label, href, title };
}

describe("KodamaLink", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("converts typed markdown link syntax into a hyperlink", () => {
    editor = createEditor();
    simulateTyping(
      editor,
      '[Click Here](https://www.kodama.page "Tooltip text")',
    );

    const link = getFirstLink(editor);
    expect(link.label).toBe("Click Here");
    expect(link.href).toMatch(/^https:\/\/www\.kodama\.page\/?$/);
    expect(link.title).toBe("Tooltip text");
    expect(editor.state.doc.textContent).toBe("Click Here");
  });

  it("converts markdown links without a title", () => {
    editor = createEditor();
    simulateTyping(editor, "[Kodama](https://kodama.page)");

    const link = getFirstLink(editor);
    expect(link.label).toBe("Kodama");
    expect(link.href).toMatch(/^https:\/\/kodama\.page\/?$/);
    expect(link.title).toBeNull();
  });

  it("applies setLink to selected text", () => {
    editor = createEditor("<p>Hello world</p>");
    selectText(editor, "Hello");
    editor.commands.setLink({ href: "https://example.com" });

    const link = getFirstLink(editor);
    expect(link.label).toBe("Hello");
    expect(link.href).toMatch(/^https:\/\/example\.com\/?$/);
  });
});
