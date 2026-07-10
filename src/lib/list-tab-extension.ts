import { Extension, type Editor } from "@tiptap/core";
import { TextSelection, type EditorState } from "@tiptap/pm/state";

const CODE_TAB_SIZE = 2;

export function listItemTypeAtSelection(state: EditorState): "listItem" | "taskItem" | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === "listItem" || name === "taskItem") return name;
  }
  return null;
}

export function selectionInListItem(state: EditorState): boolean {
  return listItemTypeAtSelection(state) !== null;
}

export function selectionInCodeBlock(state: EditorState): boolean {
  return state.selection.$from.parent.type.name === "codeBlock";
}

function indentCodeBlock(editor: Editor, shiftKey: boolean): boolean {
  const { state } = editor;
  const { selection } = state;
  const { $from, empty } = selection;
  if ($from.parent.type.name !== "codeBlock") return false;

  const indent = " ".repeat(CODE_TAB_SIZE);

  if (!shiftKey) {
    if (empty) {
      return editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.insertText(indent, selection.from, selection.to);
          return true;
        })
        .run();
    }
    return editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const { from, to } = selection;
        const text = state.doc.textBetween(from, to, "\n", "\n");
        const indentedText = text.split("\n").map((line) => indent + line).join("\n");
        tr.replaceWith(from, to, state.schema.text(indentedText));
        return true;
      })
      .run();
  }

  if (empty) {
    return editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const { pos } = $from;
        const codeBlockStart = $from.start();
        const allText = state.doc.textBetween(codeBlockStart, $from.end(), "\n", "\n");
        const lines = allText.split("\n");

        let currentLineIndex = 0;
        let charCount = 0;
        const relativeCursorPos = pos - codeBlockStart;
        for (let i = 0; i < lines.length; i += 1) {
          if (charCount + lines[i].length >= relativeCursorPos) {
            currentLineIndex = i;
            break;
          }
          charCount += lines[i].length + 1;
        }

        const currentLine = lines[currentLineIndex];
        const leadingSpaces = currentLine.match(/^ */)?.[0] ?? "";
        const spacesToRemove = Math.min(leadingSpaces.length, CODE_TAB_SIZE);
        if (spacesToRemove === 0) return true;

        let lineStartPos = codeBlockStart;
        for (let i = 0; i < currentLineIndex; i += 1) {
          lineStartPos += lines[i].length + 1;
        }

        tr.delete(lineStartPos, lineStartPos + spacesToRemove);
        const cursorPosInLine = pos - lineStartPos;
        if (cursorPosInLine <= spacesToRemove) {
          tr.setSelection(TextSelection.create(tr.doc, lineStartPos));
        }
        return true;
      })
      .run();
  }

  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const { from, to } = selection;
      const text = state.doc.textBetween(from, to, "\n", "\n");
      const outdented = text
        .split("\n")
        .map((line) => {
          const leadingSpaces = line.match(/^ */)?.[0] ?? "";
          const spacesToRemove = Math.min(leadingSpaces.length, CODE_TAB_SIZE);
          return line.slice(spacesToRemove);
        })
        .join("\n");
      tr.replaceWith(from, to, state.schema.text(outdented));
      return true;
    })
    .run();
}

export function handleEditorTabKeydown(event: KeyboardEvent, editor: Editor): boolean {
  if (event.key !== "Tab") return false;

  if (selectionInListItem(editor.state)) {
    const itemType = listItemTypeAtSelection(editor.state);
    if (!itemType) return false;
    event.preventDefault();
    event.stopPropagation();
    const chain = editor.chain().focus();
    return event.shiftKey
      ? chain.liftListItem(itemType).run()
      : chain.sinkListItem(itemType).run();
  }

  if (selectionInCodeBlock(editor.state)) {
    event.preventDefault();
    event.stopPropagation();
    return indentCodeBlock(editor, event.shiftKey);
  }

  return false;
}

/** High-priority Tab / Shift-Tab for lists and code blocks. */
export const ListTabExtension = Extension.create({
  name: "listTab",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const itemType = listItemTypeAtSelection(this.editor.state);
        if (itemType) {
          return this.editor.chain().focus().sinkListItem(itemType).run();
        }
        if (selectionInCodeBlock(this.editor.state)) {
          return indentCodeBlock(this.editor, false);
        }
        return false;
      },
      "Shift-Tab": () => {
        const itemType = listItemTypeAtSelection(this.editor.state);
        if (itemType) {
          return this.editor.chain().focus().liftListItem(itemType).run();
        }
        if (selectionInCodeBlock(this.editor.state)) {
          return indentCodeBlock(this.editor, true);
        }
        return false;
      },
    };
  },
});
