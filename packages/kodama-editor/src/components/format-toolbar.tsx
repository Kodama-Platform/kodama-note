import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Ellipsis,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Outdent,
  Quote,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  Underline,
} from "lucide-react";

import { clearFormatting } from "../lib/clear-formatting";
import { useEditorThemeStyle } from "../theme-context";

type EditorFormatToolbarProps = {
  editor: Editor | null;
  disabled?: boolean;
  onOpenLink?: () => void;
  placement?: "floating" | "static";
};

function hasTextSelection(editor: Editor): boolean {
  const { empty, from, to } = editor.state.selection;
  return !empty && from !== to;
}

function runCommand(editor: Editor, run: (chain: ReturnType<Editor["chain"]>) => void) {
  try {
    run(editor.chain().focus());
  } catch {
    // Ignore unavailable commands for the current selection/schema.
  }
}

const BUBBLE_MENU_OPTIONS = {
  strategy: "fixed" as const,
  placement: "top" as const,
  offset: 12,
  flip: true,
  shift: { padding: 12 },
  hide: false,
};

function appendBubbleToBody() {
  return document.body;
}

/** Selection toolbar: everyday styles primary; secondary tools behind More. */
export function EditorFormatToolbar({
  editor,
  disabled = false,
  onOpenLink,
  placement = "floating",
}: EditorFormatToolbarProps) {
  const themeStyle = useEditorThemeStyle();
  const [, setTick] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreOpenRef = useRef(moreOpen);
  moreOpenRef.current = moreOpen;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // Coalesce editor events — BubbleMenu focus/position churn must not setState in a loop.
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setTick((n) => n + 1);
        if (moreOpenRef.current && !hasTextSelection(editor)) {
          setMoreOpen(false);
        }
      });
    };
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);

  const shouldShow = useCallback(
    ({ editor: ed, state }: { editor: Editor; state: Editor["state"] }) => {
      if (!ed.isEditable || disabledRef.current) return false;
      const { empty, from, to } = state.selection;
      return !empty && from !== to;
    },
    [],
  );

  const bubbleOptions = useMemo(() => BUBBLE_MENU_OPTIONS, []);

  if (!editor || disabled) return null;

  const icon = "h-3.5 w-3.5";

  const controls = (
    <div className={`editor-format-toolbar-body${moreOpen ? " is-expanded" : ""}`}>
      <div className="editor-format-toolbar-row" role="group" aria-label="Primary formatting">
        <FormatGroup>
          <FormatBtn
            label="Heading 1"
            pressed={editor.isActive("heading", { level: 1 })}
            onClick={() => runCommand(editor, (c) => c.toggleHeading({ level: 1 }).run())}
          >
            <Heading1 className={icon} />
          </FormatBtn>
          <FormatBtn
            label="Heading 2"
            pressed={editor.isActive("heading", { level: 2 })}
            onClick={() => runCommand(editor, (c) => c.toggleHeading({ level: 2 }).run())}
          >
            <Heading2 className={icon} />
          </FormatBtn>
          <FormatBtn
            label="Heading 3"
            pressed={editor.isActive("heading", { level: 3 })}
            onClick={() => runCommand(editor, (c) => c.toggleHeading({ level: 3 }).run())}
          >
            <Heading3 className={icon} />
          </FormatBtn>
          <FormatBtn
            label="Bulleted list"
            pressed={editor.isActive("bulletList")}
            onClick={() => runCommand(editor, (c) => c.toggleBulletList().run())}
          >
            <List className={icon} />
          </FormatBtn>
          <FormatBtn
            label="Numbered list"
            pressed={editor.isActive("orderedList")}
            onClick={() => runCommand(editor, (c) => c.toggleOrderedList().run())}
          >
            <ListOrdered className={icon} />
          </FormatBtn>
        </FormatGroup>

        <FormatGroup>
          <FormatBtn
            label="Bold"
            pressed={editor.isActive("bold")}
            onClick={() => runCommand(editor, (c) => c.toggleBold().run())}
          >
            <Bold className={icon} />
          </FormatBtn>
          <FormatBtn
            label="Italic"
            pressed={editor.isActive("italic")}
            onClick={() => runCommand(editor, (c) => c.toggleItalic().run())}
          >
            <Italic className={icon} />
          </FormatBtn>
          <FormatBtn
            label="Link"
            pressed={editor.isActive("link")}
            onClick={() => onOpenLink?.()}
          >
            <Link2 className={icon} />
          </FormatBtn>
          <FormatBtn
            label="Highlight"
            pressed={editor.isActive("highlight")}
            onClick={() => runCommand(editor, (c) => c.toggleHighlight().run())}
          >
            <Highlighter className={icon} />
          </FormatBtn>
          <FormatBtn
            label="More formatting"
            pressed={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <Ellipsis className={icon} />
          </FormatBtn>
        </FormatGroup>
      </div>

      {moreOpen && (
        <div className="editor-format-toolbar-row editor-format-toolbar-row--more" role="group" aria-label="More formatting">
          <FormatGroup>
            <FormatBtn
              label="Quote"
              pressed={editor.isActive("blockquote")}
              onClick={() => runCommand(editor, (c) => c.toggleBlockquote().run())}
            >
              <Quote className={icon} />
            </FormatBtn>
            <FormatBtn
              label="Code block"
              pressed={editor.isActive("codeBlock")}
              onClick={() => runCommand(editor, (c) => c.toggleCodeBlock().run())}
            >
              <SquareCode className={icon} />
            </FormatBtn>
            <FormatBtn
              label="Inline code"
              pressed={editor.isActive("code")}
              onClick={() => runCommand(editor, (c) => c.toggleCode().run())}
            >
              <Code2 className={icon} />
            </FormatBtn>
            <FormatBtn
              label="Underline"
              pressed={editor.isActive("underline")}
              onClick={() => runCommand(editor, (c) => c.toggleUnderline().run())}
            >
              <Underline className={icon} />
            </FormatBtn>
            <FormatBtn
              label="Strikethrough"
              pressed={editor.isActive("strike")}
              onClick={() => runCommand(editor, (c) => c.toggleStrike().run())}
            >
              <Strikethrough className={icon} />
            </FormatBtn>
            <FormatBtn label="Clear formatting" onClick={() => clearFormatting(editor)}>
              <RemoveFormatting className={icon} />
            </FormatBtn>
          </FormatGroup>

          <FormatGroup>
            <FormatBtn
              label="Left aligned"
              pressed={
                editor.isActive({ textAlign: "left" }) ||
                (!editor.isActive({ textAlign: "center" }) &&
                  !editor.isActive({ textAlign: "right" }))
              }
              onClick={() => runCommand(editor, (c) => c.setTextAlign("left").run())}
            >
              <AlignLeft className={icon} />
            </FormatBtn>
            <FormatBtn
              label="Center aligned"
              pressed={editor.isActive({ textAlign: "center" })}
              onClick={() => runCommand(editor, (c) => c.setTextAlign("center").run())}
            >
              <AlignCenter className={icon} />
            </FormatBtn>
            <FormatBtn
              label="Right aligned"
              pressed={editor.isActive({ textAlign: "right" })}
              onClick={() => runCommand(editor, (c) => c.setTextAlign("right").run())}
            >
              <AlignRight className={icon} />
            </FormatBtn>
            <FormatBtn
              label="Indent"
              onClick={() => runCommand(editor, (c) => c.indent().run())}
            >
              <Indent className={icon} />
            </FormatBtn>
            <FormatBtn
              label="Outdent"
              onClick={() => runCommand(editor, (c) => c.outdent().run())}
            >
              <Outdent className={icon} />
            </FormatBtn>
          </FormatGroup>
        </div>
      )}
    </div>
  );

  if (placement === "static") {
    if (!hasTextSelection(editor)) return null;
    return (
      <div
        data-editor-bubble-toolbar="true"
        className="editor-format-toolbar editor-format-toolbar--static"
        role="toolbar"
        aria-label="Text formatting"
        style={themeStyle}
      >
        {controls}
      </div>
    );
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="kodamaFormatBubble"
      updateDelay={60}
      appendTo={appendBubbleToBody}
      shouldShow={shouldShow}
      options={bubbleOptions}
      data-editor-bubble-toolbar="true"
      className="editor-format-toolbar editor-format-toolbar--floating"
      role="toolbar"
      aria-label="Text formatting"
      style={themeStyle}
    >
      {controls}
    </BubbleMenu>
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
