import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  SquareCode,
  Table,
} from "lucide-react";

type SlashItem = {
  id: string;
  label: string;
  keywords: string;
  icon: React.ReactNode;
  run: (editor: Editor) => void;
};

const ITEMS: SlashItem[] = [
  {
    id: "h1",
    label: "Heading 1",
    keywords: "h1 title",
    icon: <Heading1 className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    keywords: "h2",
    icon: <Heading2 className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    keywords: "h3",
    icon: <Heading3 className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "List",
    keywords: "bullet ul",
    icon: <List className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "Numbered list",
    keywords: "ol numbered",
    icon: <ListOrdered className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "check",
    label: "Checklist",
    keywords: "todo task check",
    icon: <ListTodo className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().toggleTaskList().run(),
  },
  {
    id: "table",
    label: "Table",
    keywords: "grid",
    icon: <Table className="h-3.5 w-3.5" />,
    run: (ed) =>
      ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "quote",
    label: "Quote",
    keywords: "blockquote",
    icon: <Quote className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Code",
    keywords: "codeblock",
    icon: <SquareCode className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "hr",
    label: "Divider",
    keywords: "hr horizontal rule",
    icon: <Minus className="h-3.5 w-3.5" />,
    run: (ed) => ed.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "image",
    label: "Image",
    keywords: "picture photo",
    icon: <ImageIcon className="h-3.5 w-3.5" />,
    run: (ed) => {
      const url = window.prompt("Image URL");
      if (url) {
        ed.chain().focus().insertContent({ type: "image", attrs: { src: url } }).run();
      }
    },
  },
];

type SlashState = {
  query: string;
  from: number;
  to: number;
  top: number;
  left: number;
};

/** `/` command menu for block inserts. */
export function EditorSlashMenu({
  editor,
  disabled = false,
}: {
  editor: Editor | null;
  disabled?: boolean;
}) {
  const [state, setState] = useState<SlashState | null>(null);
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    if (!state) return [];
    const q = state.query.toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.keywords.includes(q),
    );
  }, [state]);

  useEffect(() => {
    if (!editor || disabled) {
      setState(null);
      return;
    }

    const onUpdate = () => {
      const { selection, doc } = editor.state;
      if (!selection.empty) {
        setState(null);
        return;
      }
      const $from = selection.$from;
      const parent = $from.parent;
      if (!parent.isTextblock) {
        setState(null);
        return;
      }
      const textBefore = parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      const match = textBefore.match(/(?:^|\s)\/([^\s]*)$/);
      if (!match) {
        setState(null);
        return;
      }
      const query = match[1] ?? "";
      const slashStart = $from.start() + textBefore.length - query.length - 1;
      const coords = editor.view.coordsAtPos(slashStart);
      setState({
        query,
        from: slashStart,
        to: selection.from,
        top: coords.bottom + 6,
        left: coords.left,
      });
      setActive(0);
    };

    editor.on("selectionUpdate", onUpdate);
    editor.on("transaction", onUpdate);
    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("transaction", onUpdate);
    };
  }, [editor, disabled]);

  useEffect(() => {
    if (!state || !editor) return;
    const onKey = (e: KeyboardEvent) => {
      if (!filtered.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[active];
        if (item) runItem(editor, state, item);
      } else if (e.key === "Escape") {
        setState(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [state, editor, filtered, active]);

  if (!editor || !state || filtered.length === 0) return null;

  return (
    <div
      data-editor-slash-menu="true"
      className="editor-slash-menu"
      style={{ top: state.top, left: state.left }}
      role="listbox"
      aria-label="Insert commands"
    >
      {filtered.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={i === active}
          className={`editor-slash-item${i === active ? " is-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runItem(editor, state, item)}
        >
          <span className="editor-slash-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function runItem(editor: Editor, state: SlashState, item: SlashItem) {
  editor
    .chain()
    .focus()
    .deleteRange({ from: state.from, to: state.to })
    .run();
  item.run(editor);
}

/** Block inserts available from the hover `+` control (image upload stays disabled). */
export const BLOCK_INSERT_ITEMS = ITEMS.filter((i) => i.id !== "image");

/** Hover `+` control for the current block. */
export function EditorBlockInsertButton({
  editor,
  disabled = false,
}: {
  editor: Editor | null;
  disabled?: boolean;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!editor || disabled) {
      setPos(null);
      return;
    }
    const update = () => {
      if (!editor.isFocused || !editor.state.selection.empty) {
        setPos(null);
        setOpen(false);
        return;
      }
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.$from.start());
        const editorRect = editor.view.dom.getBoundingClientRect();
        setPos({
          top: coords.top,
          left: Math.max(8, editorRect.left - 28),
        });
      } catch {
        setPos(null);
      }
    };
    editor.on("selectionUpdate", update);
    editor.on("focus", update);
    editor.on("blur", () => {
      // Delay so menu clicks can land.
      window.setTimeout(() => {
        if (!editor.isFocused) {
          setPos(null);
          setOpen(false);
        }
      }, 150);
    });
    update();
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
    };
  }, [editor, disabled]);

  if (!editor || !pos) return null;

  const menu = open
    ? createPortal(
        <div
          data-editor-block-insert-menu="true"
          className="editor-slash-menu editor-slash-menu--block-insert"
          style={{ top: pos.top + 28, left: pos.left }}
          role="menu"
          aria-label="Insert block"
        >
          {BLOCK_INSERT_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="editor-slash-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                item.run(editor);
                setOpen(false);
                editor.commands.focus();
              }}
            >
              <span className="editor-slash-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        data-editor-block-insert="true"
        className="editor-block-insert"
        style={{ top: pos.top, left: pos.left }}
      >
        <button
          type="button"
          className="editor-block-insert-btn"
          aria-label="Insert block"
          title="Insert"
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
        >
          +
        </button>
      </div>
      {menu}
    </>
  );
}
