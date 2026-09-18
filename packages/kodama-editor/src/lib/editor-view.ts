import type { Editor } from "@tiptap/react";

/** TipTap 3 throws if `view.dom` is read before the ProseMirror view is mounted. */
export function getMountedEditorDom(editor: Editor | null | undefined): HTMLElement | null {
  if (!editor || editor.isDestroyed) return null;
  try {
    const dom = editor.view.dom;
    return dom instanceof HTMLElement ? dom : null;
  } catch {
    return null;
  }
}

export function posAtEditorCoords(
  editor: Editor,
  left: number,
  top: number,
): number | undefined {
  try {
    return editor.view.posAtCoords({ left, top })?.pos;
  } catch {
    return undefined;
  }
}
