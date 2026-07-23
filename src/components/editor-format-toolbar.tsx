import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Table,
  Type,
  Undo2,
} from "lucide-react";

type EditorFormatToolbarProps = {
  editor: Editor | null;
  disabled?: boolean;
  onOpenLink?: () => void;
  onInsertImage?: (file: File) => void;
};

export function EditorFormatToolbar({
  editor,
  disabled = false,
  onOpenLink,
  onInsertImage,
}: EditorFormatToolbarProps) {
  const [, setTick] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);

  if (!editor || disabled) return null;

  return (
    <div
      data-editor-chrome="true"
      className="editor-format-toolbar"
      role="toolbar"
      aria-label="Text formatting"
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onInsertImage?.(file);
        }}
      />

      <div className="editor-format-toolbar-scroll">
        <FormatGroup>
          <FormatBtn
            label="Paragraph"
            pressed={!editor.isActive("heading") && !editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            <Type className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Heading 1"
            pressed={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Heading 2"
            pressed={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Heading 3"
            pressed={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-3.5 w-3.5" />
          </FormatBtn>
        </FormatGroup>

        <FormatGroup>
          <FormatBtn
            label="Bold"
            pressed={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Italic"
            pressed={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Inline code"
            pressed={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code2 className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Link"
            pressed={editor.isActive("link")}
            onClick={() => onOpenLink?.()}
          >
            <Link2 className="h-3.5 w-3.5" />
          </FormatBtn>
        </FormatGroup>

        <FormatGroup>
          <FormatBtn
            label="Bullet list"
            pressed={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Numbered list"
            pressed={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Task list"
            pressed={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListTodo className="h-3.5 w-3.5" />
          </FormatBtn>
        </FormatGroup>

        <FormatGroup>
          <FormatBtn
            label="Quote"
            pressed={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Code block"
            pressed={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <SquareCode className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Separator"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Image"
            disabled={!onInsertImage}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Table"
            pressed={editor.isActive("table")}
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            <Table className="h-3.5 w-3.5" />
          </FormatBtn>
        </FormatGroup>

        <FormatGroup>
          <FormatBtn
            label="Undo"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Redo"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </FormatBtn>
        </FormatGroup>
      </div>
    </div>
  );
}

function FormatGroup({ children }: { children: React.ReactNode }) {
  return <div className="editor-format-group">{children}</div>;
}

function FormatBtn({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="editor-format-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
