import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addSheet,
  collectWorkbookAttachmentIds,
  createEmptyWorkbook,
  deleteSheet,
  exportWorkbookMarkdown,
  migrateLegacyMarkdown,
  parseWorkbook,
  reorderSheets,
  resolveInitialSheetId,
  serializeWorkbook,
  validateWorkbook,
  WorkbookError,
  WORKBOOK_LIMITS,
} from "@/lib/workbook";

const SHEET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SHEET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  let n = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => {
      n += 1;
      return n === 1 ? SHEET_A : SHEET_B;
    },
  });
});

describe("parseWorkbook", () => {
  it("migrates legacy markdown to a single Main sheet", () => {
    const wb = parseWorkbook("# Hello\n\nWorld");
    expect(wb.schema_version).toBe(1);
    expect(wb.sheets).toHaveLength(1);
    expect(wb.sheets[0].title).toBe("Main");
    expect(wb.sheets[0].markdown).toBe("# Hello\n\nWorld");
    expect(wb.primary_sheet_id).toBe(SHEET_A);
  });

  it("parses empty string as empty workbook", () => {
    const wb = parseWorkbook("");
    expect(wb.sheets[0].markdown).toBe("");
  });

  it("round-trips workbook JSON", () => {
    const original = migrateLegacyMarkdown("note body");
    const bytes = serializeWorkbook(original);
    const parsed = parseWorkbook(bytes);
    expect(parsed.sheets[0].markdown).toBe("note body");
    expect(parsed.primary_sheet_id).toBe(original.primary_sheet_id);
  });
});

describe("serializeWorkbook", () => {
  it("uses canonical key order", () => {
    const wb = migrateLegacyMarkdown("x");
    const json = serializeWorkbook(wb);
    expect(json.indexOf('"schema_version"')).toBeLessThan(json.indexOf('"primary_sheet_id"'));
    expect(json.indexOf('"primary_sheet_id"')).toBeLessThan(json.indexOf('"sheets"'));
    const sheetStart = json.indexOf('"sheets"');
    expect(json.indexOf('"sheet_id"', sheetStart)).toBeLessThan(json.indexOf('"title"', sheetStart));
    expect(json.indexOf('"title"', sheetStart)).toBeLessThan(json.indexOf('"order"', sheetStart));
    expect(json.indexOf('"order"', sheetStart)).toBeLessThan(json.indexOf('"markdown"', sheetStart));
  });

  it("preserves newlines in markdown", () => {
    const wb = migrateLegacyMarkdown("line1\nline2");
    const json = serializeWorkbook(wb);
    expect(json).toContain("line1\\nline2");
    expect(parseWorkbook(json).sheets[0].markdown).toBe("line1\nline2");
  });
});

describe("sheet CRUD", () => {
  it("adds sheets with default titles", () => {
    let wb = migrateLegacyMarkdown("");
    wb = addSheet(wb);
    expect(wb.sheets).toHaveLength(2);
    expect(wb.sheets[1].title).toBe("Sheet 2");
  });

  it("blocks delete when only one sheet remains", () => {
    const wb = migrateLegacyMarkdown("content");
    expect(() => deleteSheet(wb, wb.sheets[0].sheet_id)).toThrow(WorkbookError);
  });

  it("reorders sheets by id list", () => {
    let wb = migrateLegacyMarkdown("a");
    wb = addSheet(wb);
    const ids = wb.sheets.map((s) => s.sheet_id).reverse();
    const reordered = reorderSheets(wb, ids);
    expect(reordered.sheets.map((s) => s.order)).toEqual([0, 1]);
    expect(reordered.sheets[0].sheet_id).toBe(ids[0]);
  });
});

describe("limits", () => {
  it("rejects sheet markdown over 256 KB", () => {
    const wb = migrateLegacyMarkdown("x".repeat(WORKBOOK_LIMITS.maxMarkdownPerSheet + 1));
    expect(() => validateWorkbook(wb)).toThrow(WorkbookError);
  });

  it("rejects too many sheets on add", () => {
    let wb = migrateLegacyMarkdown("");
    for (let i = 0; i < WORKBOOK_LIMITS.maxSheets - 1; i++) wb = addSheet(wb);
    expect(() => addSheet(wb)).toThrow(WorkbookError);
  });
});

describe("resolveInitialSheetId", () => {
  it("falls back to primary when hash id is invalid", () => {
    const wb = migrateLegacyMarkdown("");
    expect(resolveInitialSheetId(wb, "not-a-real-id")).toBe(wb.primary_sheet_id);
  });

  it("uses preferred id when valid", () => {
    const wb = migrateLegacyMarkdown("");
    expect(resolveInitialSheetId(wb, wb.sheets[0].sheet_id)).toBe(wb.sheets[0].sheet_id);
  });
});

describe("collectWorkbookAttachmentIds", () => {
  it("scans all sheets for kodama-att refs", () => {
    const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    let wb = migrateLegacyMarkdown(`![a](kodama-att:${id})`);
    wb = addSheet(wb);
    wb = {
      ...wb,
      sheets: wb.sheets.map((s, i) =>
        i === 1 ? { ...s, markdown: `ref kodama-att:${id}` } : s,
      ),
    };
    const refs = collectWorkbookAttachmentIds(wb);
    expect(refs.has(id)).toBe(true);
  });
});

describe("exportWorkbookMarkdown", () => {
  it("joins sheets with separators", () => {
    let wb = migrateLegacyMarkdown("alpha");
    wb = addSheet(wb);
    wb = {
      ...wb,
      sheets: wb.sheets.map((s, i) =>
        i === 1 ? { ...s, title: "Notes", markdown: "beta" } : s,
      ),
    };
    const out = exportWorkbookMarkdown(wb);
    expect(out).toContain("# Sheet: Main");
    expect(out).toContain("alpha");
    expect(out).toContain("# Sheet: Notes");
    expect(out).toContain("beta");
    expect(out).toContain("---");
  });
});

describe("createEmptyWorkbook", () => {
  it("creates a single empty Main sheet", () => {
    const wb = createEmptyWorkbook();
    expect(wb.sheets).toHaveLength(1);
    expect(wb.sheets[0].title).toBe("Main");
    expect(wb.sheets[0].markdown).toBe("");
  });
});
