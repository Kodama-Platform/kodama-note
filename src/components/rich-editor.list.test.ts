import { describe, it, expect, afterEach } from "vitest";
import { Editor, generateJSON } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

import { handleEditorTabKeydown, selectionInCodeBlock } from "@/lib/list-tab-extension";
import { KodamaBulletList, KodamaTaskItem, TaskList } from "@/lib/kodama-task-list";
import { normalizeTaskListMarkdown } from "@/lib/normalize-task-markdown";
function createEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        bulletList: false,
        codeBlock: { enableTabIndentation: true, tabSize: 2 },
      }),
      KodamaBulletList,
      TaskList,
      KodamaTaskItem.configure({ nested: true }),
      Markdown.configure({
        html: false,
        breaks: true,
      }),
    ],
    content,
  });
}

describe("RichEditor list Tab", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("parses markdown bullets into a bulletList", () => {
    editor = createEditor("- one\n- two");
    const json = editor.getJSON();
    expect(json.content?.[0]?.type).toBe("bulletList");
  });

  it("sinkListItem nests the second bullet under the first", () => {
    editor = createEditor("- one\n- two");
    const secondItemPos = findListItemPos(editor, 1);
    expect(secondItemPos).toBeGreaterThan(0);

    editor.commands.setTextSelection(secondItemPos + 2);
    expect(editor.isActive("listItem")).toBe(true);

    const sunk = editor.commands.sinkListItem("listItem");
    expect(sunk).toBe(true);

    const md = editor.storage.markdown.getMarkdown();
    expect(md).toMatch(/one[\s\S]*- two/);
    expect(md).toMatch(/^\s+- two/m);
  });

  it("inserts spaces on Tab in a code block", () => {
    editor = createEditor("```\nconst x = 1\n```");
    expect(editor.getJSON().content?.[0]?.type).toBe("codeBlock");

    let pos = -1;
    editor.state.doc.descendants((node, nodePos) => {
      if (pos !== -1) return false;
      if (node.type.name === "codeBlock") {
        pos = nodePos + 1;
        return false;
      }
    });
    expect(pos).toBeGreaterThan(0);

    editor.commands.setTextSelection(pos);
    expect(selectionInCodeBlock(editor.state)).toBe(true);

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    handleEditorTabKeydown(event, editor);
    expect(editor.state.doc.textBetween(pos, pos + 2)).toBe("  ");
  });

  it("parses GFM task list markdown", () => {
    editor = createEditor("- [ ] todo\n- [x] done");
    expect(editor.getJSON().content?.[0]?.type).toBe("taskList");
    const items = editor.getJSON().content?.[0]?.content ?? [];
    expect(items[0]?.attrs?.checked).toBe(false);
    expect(items[1]?.attrs?.checked).toBe(true);
  });

  it("serializes checked state back to markdown", () => {
    editor = createEditor("- [ ] todo");
    let taskPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (taskPos === -1 && node.type.name === "taskItem") taskPos = pos;
    });
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.setNodeMarkup(taskPos, undefined, { checked: true });
        return true;
      })
      .run();
    expect(editor.storage.markdown.getMarkdown()).toMatch(/- \[x\] todo/);
  });

  it("pastes normalized task list markdown at the cursor", () => {
    const sample = `- [] one\n- [x] two`;
    editor = createEditor("<p></p>");
    const normalized = normalizeTaskListMarkdown(sample);
    const html = editor.storage.markdown.parser.parse(normalized, { inline: false });
    const doc = generateJSON(html, editor.extensionManager.extensions);
    editor.chain().focus().insertContentAt(1, doc).run();

    const items: boolean[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "taskItem") items.push(!!node.attrs.checked);
    });
    expect(items).toEqual([false, true]);
  });
});

function findListItemPos(ed: Editor, index: number): number {
  let i = 0;
  let pos = -1;
  ed.state.doc.descendants((node, nodePos) => {
    if (pos !== -1) return false;
    if (node.type.name === "listItem") {
      if (i === index) {
        pos = nodePos;
        return false;
      }
      i += 1;
    }
  });
  return pos;
}
