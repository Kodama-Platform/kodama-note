import { describe, expect, it } from "vitest";

import { migrateLegacyMarkdown, serializeWorkbook } from "@/lib/workbook";
import { flushActiveSheetMarkdown, isWorkbookDirty } from "@/lib/workbook-flush";

describe("workbook-flush", () => {
  it("detects dirty when active sheet markdown differs", () => {
    const workbook = migrateLegacyMarkdown("hello");
    const sheetId = workbook.primary_sheet_id;
    const lastSaved = serializeWorkbook(workbook);
    const editorRef = {
      current: { getMarkdown: () => "hello world" },
    };
    expect(isWorkbookDirty(workbook, sheetId, editorRef, lastSaved)).toBe(true);
  });

  it("flushes editor markdown into the active sheet", () => {
    const workbook = migrateLegacyMarkdown("hello");
    const sheetId = workbook.primary_sheet_id;
    const editorRef = {
      current: { getMarkdown: () => "updated" },
    };
    const flushed = flushActiveSheetMarkdown(workbook, sheetId, editorRef);
    expect(flushed.sheets[0].markdown).toBe("updated");
  });
});
