import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";

import { KodamaParagraph, KodamaHeading } from "@/lib/kodama-aligned-blocks";
import { KodamaHighlight } from "@/lib/kodama-highlight";
import { KodamaIndent } from "@/lib/kodama-indent";
import { KodamaText } from "@/lib/kodama-html-passthrough";
import { KodamaMarkdownHtml } from "@/lib/kodama-markdown-html";
import { KodamaSubscript, KodamaSuperscript, KodamaUnderline } from "@/lib/kodama-marks";

function createEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        text: false,
        underline: false,
        link: false,
      }),
      KodamaText,
      KodamaParagraph,
      KodamaHeading.configure({ levels: [1, 2, 3] }),
      KodamaUnderline,
      KodamaSubscript,
      KodamaSuperscript,
      KodamaHighlight,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      KodamaIndent,
      KodamaMarkdownHtml,
      Markdown.configure({ html: false, linkify: true, breaks: true }),
    ],
    content,
  });
}

function typeText(editor: Editor, text: string) {
  editor.commands.focus("end");
  for (const char of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(editor.view, from, to, char, () => editor.state.tr),
    );
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
  }
}

describe("raw HTML handling", () => {
  let editor: Editor | null = null;
  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("renders whitelisted inline tags as marks", () => {
    editor = createEditor("a <b>b</b> <i>i</i> <s>s</s> <mark>m</mark> <code>c</code> <u>u</u>");
    expect(editor.storage.markdown.getMarkdown()).toBe("a **b** *i* ~~s~~ ==m== `c` <u>u</u>");
  });

  it("renders whitelisted block tags as real blocks", () => {
    editor = createEditor('<h2 style="text-align: right">R</h2>');
    const heading = editor.getJSON().content?.[0] as
      | { type?: string; attrs?: { level?: number; textAlign?: string } }
      | undefined;
    expect(heading?.type).toBe("heading");
    expect(heading?.attrs?.level).toBe(2);
    expect(editor.storage.markdown.getMarkdown()).toContain("R");
  });

  it("keeps non-whitelisted HTML verbatim on export instead of escaping it", () => {
    editor = createEditor('<div class="x">Text</div>\n\n<br>');
    const md = editor.storage.markdown.getMarkdown() as string;
    expect(md).toContain('<div class="x">Text</div>');
    expect(md).toContain("<br>");
    expect(md).not.toContain("&lt;");
  });

  it("does not escape bare angle brackets", () => {
    editor = createEditor("1 < 2 and 3 > 2");
    expect(editor.storage.markdown.getMarkdown()).toBe("1 < 2 and 3 > 2");
  });

  it("round-trips typed unknown HTML verbatim", () => {
    editor = createEditor("");
    typeText(editor, "<div>Text</div>");
    expect(editor.storage.markdown.getMarkdown()).toBe("<div>Text</div>");
  });

  it("converts typed whitelisted inline tags into marks", () => {
    editor = createEditor("");
    typeText(editor, "a <b>bold</b>");
    expect(editor.storage.markdown.getMarkdown()).toBe("a **bold**");
  });
});
