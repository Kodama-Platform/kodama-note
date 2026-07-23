import { describe, expect, it } from "vitest";

import { migrateLegacyMarkdown } from "@/lib/workbook";
import { flushActiveSheetMarkdown } from "@/lib/workbook-flush";

describe("workbook-flush", () => {
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
