import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { normalizeTaskListMarkdown } from "@/lib/normalize-task-markdown";
import { KodamaBulletList, KodamaTaskItem, TaskList } from "@/lib/kodama-task-list";

const USER_SAMPLE = `### 14.3 Attachment acceptance

- [] Image not present in Markdown as base64
- [ x ] Attachment AAD differs from document AAD
- [ ] Replace image in doc → new attachment_id; old blob orphaned (GC optional)
- [x] Text-only edit does not re-upload unchanged images`;

function createEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        bulletList: false,
      }),
      KodamaBulletList,
      TaskList,
      KodamaTaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, breaks: true }),
    ],
    content: normalizeTaskListMarkdown(content),
  });
}

describe("normalizeTaskListMarkdown", () => {
  it("normalizes common checkbox variants", () => {
    const out = normalizeTaskListMarkdown(USER_SAMPLE);
    expect(out).toContain("- [ ] Image not present");
    expect(out).toContain("- [x] Attachment AAD differs");
    expect(out).toContain("- [ ] Replace image in doc");
    expect(out).toContain("- [x] Text-only edit");
  });
});

describe("task list paste content", () => {
  it("parses normalized user sample as taskList items", () => {
    const editor = createEditor(USER_SAMPLE);
    const types: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "taskList" || node.type.name === "taskItem") {
        types.push(node.type.name);
      }
    });
    expect(types.filter((t) => t === "taskList").length).toBeGreaterThan(0);
    expect(types.filter((t) => t === "taskItem").length).toBe(4);

    const checked: boolean[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "taskItem") checked.push(!!node.attrs.checked);
    });
    expect(checked).toEqual([false, true, false, true]);
    editor.destroy();
  });
});
