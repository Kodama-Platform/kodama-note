import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { KodamaBulletList, KodamaTaskItem, TaskList } from "@/lib/kodama-task-list";

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
    content,
  });
}

describe("task list DOM", () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it("renders interactive checkbox controls in task list items", () => {
    editor = createEditor("- [ ] todo\n- [x] done");
    const list = editor.view.dom.querySelector('ul[data-type="taskList"]');
    expect(list).not.toBeNull();

    const items = editor.view.dom.querySelectorAll('ul[data-type="taskList"] > li');
    expect(items.length).toBe(2);
    items.forEach((li) => {
      const checkbox = li.querySelector("label input[type=checkbox]") as HTMLInputElement | null;
      expect(checkbox).not.toBeNull();
      expect(li.querySelector("div")).not.toBeNull();
      expect(li.getAttribute("data-checked")).toBeTruthy();
    });
    expect((items[1]?.querySelector("input") as HTMLInputElement).checked).toBe(true);
  });
});
