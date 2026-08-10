import type { Editor } from "@tiptap/core";

/** Strip marks, reset block to paragraph, clear align/indent. */
export function clearFormatting(editor: Editor): boolean {
  return editor
    .chain()
    .focus()
    .unsetAllMarks()
    .clearNodes()
    .unsetTextAlign()
    .command(({ tr, state, dispatch }) => {
      const { from, to } = state.selection;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === "paragraph" || node.type.name === "heading") {
          if (node.attrs.indent) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: 0 });
          }
        }
      });
      if (dispatch) dispatch(tr);
      return true;
    })
    .run();
}
