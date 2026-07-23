import { fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorFormatToolbar } from "@/components/editor-format-toolbar";
import { KodamaBulletList, KodamaTaskItem, TaskList } from "@/lib/kodama-task-list";

function createToolbarEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({ bulletList: false }),
      KodamaBulletList,
      TaskList,
      KodamaTaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: "<p>hello</p>",
  });
}

describe("EditorFormatToolbar", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("toggles bold via the toolbar", () => {
    editor = createToolbarEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });

    render(<EditorFormatToolbar editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(editor.isActive("bold")).toBe(true);
  });

  it("toggles inline code, quote, and code block", () => {
    editor = createToolbarEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });

    render(<EditorFormatToolbar editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Inline code" }));
    expect(editor.isActive("code")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Quote" }));
    expect(editor.isActive("blockquote")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Code block" }));
    expect(editor.isActive("codeBlock")).toBe(true);
  });

  it("inserts a separator and a table", () => {
    editor = createToolbarEditor();

    render(<EditorFormatToolbar editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Separator" }));
    expect(editor.getHTML()).toContain("<hr");

    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(editor.isActive("table")).toBe(true);
  });

  it("opens the image picker when Image is clicked", () => {
    editor = createToolbarEditor();
    const onInsertImage = vi.fn();

    const { container } = render(
      <EditorFormatToolbar editor={editor} onInsertImage={onInsertImage} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Image" }));
    expect(clickSpy).toHaveBeenCalled();
  });
});
