import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

import { collectTextMatches, textOffsetToPos } from "@/lib/editor-find";

function createEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Markdown.configure({ html: false, breaks: true }),
    ],
    content,
  });
}

describe("editor-find", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("finds matches in visible document text, not markdown syntax", () => {
    editor = createEditor("# Hello world\n\nSecond **bold** line");
    const matches = collectTextMatches(editor.state.doc, "Hello");
    expect(matches).toHaveLength(1);
    const text = editor.state.doc.textBetween(matches[0].from, matches[0].to);
    expect(text).toBe("Hello");
  });

  it("finds matches across paragraphs", () => {
    editor = createEditor("alpha\n\nbeta alpha");
    const matches = collectTextMatches(editor.state.doc, "alpha");
    expect(matches).toHaveLength(2);
    expect(editor.state.doc.textBetween(matches[0].from, matches[0].to)).toBe("alpha");
    expect(editor.state.doc.textBetween(matches[1].from, matches[1].to)).toBe("alpha");
  });

  it("maps plain-text offsets to document positions", () => {
    editor = createEditor("abc\ndef");
    const doc = editor.state.doc;
    const segments: { from: number; text: string }[] = [];
    doc.descendants((node, pos) => {
      if (node.isText && node.text) segments.push({ from: pos, text: node.text });
    });
    const plain = segments.map((s) => s.text).join("");
    expect(plain).toBe("abcdef");
    const posD = textOffsetToPos(segments, plain.indexOf("d"));
    expect(editor.state.doc.textBetween(posD, posD + 1)).toBe("d");
  });

  it("is case-insensitive when collecting matches", () => {
    editor = createEditor("Foo BAR foo");
    const matches = collectTextMatches(editor.state.doc, "foo");
    expect(matches).toHaveLength(2);
    expect(editor.state.doc.textBetween(matches[0].from, matches[0].to)).toBe("Foo");
    expect(editor.state.doc.textBetween(matches[1].from, matches[1].to)).toBe("foo");
  });
});
