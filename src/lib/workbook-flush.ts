import type { RichEditorHandle } from "@/components/rich-editor";
import {
  getActiveSheetMarkdown,
  getSheetById,
  updateActiveSheetMarkdown,
  type WorkbookPayload,
} from "@/lib/workbook";

export function flushActiveSheetMarkdown(
  workbook: WorkbookPayload,
  activeSheetId: string,
  editorRef: React.RefObject<RichEditorHandle | null>,
): WorkbookPayload {
  if (!getSheetById(workbook, activeSheetId)) return workbook;
  const markdown =
    editorRef.current?.getMarkdown() ?? getActiveSheetMarkdown(workbook, activeSheetId);
  return updateActiveSheetMarkdown(workbook, activeSheetId, markdown);
}
