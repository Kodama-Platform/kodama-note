import { KODAMA_ATT_PREFIX } from "@/lib/kodama-image";

export const WORKBOOK_LIMITS = {
  maxSheets: 20,
  maxTitleLength: 80,
  maxMarkdownPerSheet: 256 * 1024,
  maxWorkbookTotal: 1024 * 1024,
} as const;

export type SheetMeta = {
  sheet_id: string;
  title: string;
  order: number;
  created_at?: string;
  updated_at?: string;
};

export type WorkbookSheet = SheetMeta & {
  markdown: string;
  attachment_ids?: string[];
};

export type WorkbookPayload = {
  schema_version: 1;
  primary_sheet_id: string;
  sheets: WorkbookSheet[];
};

export type WorkbookValidationError =
  | "too_many_sheets"
  | "title_too_long"
  | "sheet_too_large"
  | "workbook_too_large"
  | "empty_workbook"
  | "duplicate_sheet_id"
  | "invalid_primary_sheet"
  | "duplicate_attachment_id";

export class WorkbookError extends Error {
  constructor(public code: WorkbookValidationError) {
    super(code);
    this.name = "WorkbookError";
  }
}

function newSheetId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function sortedSheets(sheets: WorkbookSheet[]): WorkbookSheet[] {
  return [...sheets].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Canonical JSON: stable top-level keys and sheet field order. */
export function serializeWorkbook(payload: WorkbookPayload): string {
  validateWorkbook(payload);
  const sheets = sortedSheets(payload.sheets).map((sheet) => {
    const out: Record<string, string | number | string[]> = {
      sheet_id: sheet.sheet_id,
      title: sheet.title,
      order: sheet.order,
      markdown: sheet.markdown,
    };
    if (sheet.attachment_ids?.length) out.attachment_ids = sheet.attachment_ids;
    if (sheet.created_at) out.created_at = sheet.created_at;
    if (sheet.updated_at) out.updated_at = sheet.updated_at;
    return out;
  });

  return JSON.stringify({
    schema_version: 1,
    primary_sheet_id: payload.primary_sheet_id,
    sheets,
  });
}

function isWorkbookJsonObject(value: unknown): value is {
  schema_version: number;
  primary_sheet_id: string;
  sheets: Array<Record<string, unknown>>;
} {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.schema_version === 1 &&
    typeof obj.primary_sheet_id === "string" &&
    Array.isArray(obj.sheets)
  );
}

function normalizeAttachmentIds(raw: unknown, markdown: string): string[] {
  if (Array.isArray(raw)) {
    const ids = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (ids.length) return [...new Set(ids)];
  }
  return [...collectSheetAttachmentRefs(markdown)];
}

function normalizeSheet(raw: Record<string, unknown>, index: number): WorkbookSheet {
  const sheet_id = typeof raw.sheet_id === "string" ? raw.sheet_id : newSheetId();
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, WORKBOOK_LIMITS.maxTitleLength)
      : "Main";
  const order = typeof raw.order === "number" ? raw.order : index;
  const markdown = typeof raw.markdown === "string" ? raw.markdown : "";
  const attachment_ids = normalizeAttachmentIds(raw.attachment_ids, markdown);
  const created_at = typeof raw.created_at === "string" ? raw.created_at : undefined;
  const updated_at = typeof raw.updated_at === "string" ? raw.updated_at : undefined;
  const sheet: WorkbookSheet = { sheet_id, title, order, markdown, created_at, updated_at };
  if (attachment_ids.length) sheet.attachment_ids = attachment_ids;
  return sheet;
}

/** Parse decrypted plaintext — migrates legacy single-markdown notes. */
export function parseWorkbook(plaintext: string): WorkbookPayload {
  const trimmed = plaintext.trim();
  if (!trimmed) return createEmptyWorkbook();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (isWorkbookJsonObject(parsed)) {
        const sheets = parsed.sheets.map((s, i) => normalizeSheet(s, i));
        if (sheets.length === 0) return createEmptyWorkbook();
        const primary =
          sheets.find((s) => s.sheet_id === parsed.primary_sheet_id)?.sheet_id ??
          sheets[0].sheet_id;
        const payload: WorkbookPayload = {
          schema_version: 1,
          primary_sheet_id: primary,
          sheets: sortedSheets(sheets),
        };
        validateWorkbook(payload);
        return payload;
      }
    } catch {
      /* fall through to legacy markdown */
    }
  }

  return migrateLegacyMarkdown(plaintext);
}

export function migrateLegacyMarkdown(markdown: string): WorkbookPayload {
  const sheet_id = newSheetId();
  const ts = nowIso();
  const attachment_ids = [...collectSheetAttachmentRefs(markdown)];
  const sheet: WorkbookSheet = {
    sheet_id,
    title: "Main",
    order: 0,
    markdown,
    created_at: ts,
    updated_at: ts,
  };
  if (attachment_ids.length) sheet.attachment_ids = attachment_ids;
  return {
    schema_version: 1,
    primary_sheet_id: sheet_id,
    sheets: [sheet],
  };
}

export function createEmptyWorkbook(): WorkbookPayload {
  const sheet_id = newSheetId();
  const ts = nowIso();
  return {
    schema_version: 1,
    primary_sheet_id: sheet_id,
    sheets: [
      {
        sheet_id,
        title: "Main",
        order: 0,
        markdown: "",
        created_at: ts,
        updated_at: ts,
      },
    ],
  };
}

export function validateWorkbook(payload: WorkbookPayload): void {
  if (!payload.sheets.length) throw new WorkbookError("empty_workbook");
  if (payload.sheets.length > WORKBOOK_LIMITS.maxSheets) {
    throw new WorkbookError("too_many_sheets");
  }

  const ids = new Set<string>();
  let totalBytes = 0;
  for (const sheet of payload.sheets) {
    if (ids.has(sheet.sheet_id)) throw new WorkbookError("duplicate_sheet_id");
    ids.add(sheet.sheet_id);
    if (sheet.title.length > WORKBOOK_LIMITS.maxTitleLength) {
      throw new WorkbookError("title_too_long");
    }
    const sheetBytes = new TextEncoder().encode(sheet.markdown).length;
    if (sheetBytes > WORKBOOK_LIMITS.maxMarkdownPerSheet) {
      throw new WorkbookError("sheet_too_large");
    }
    totalBytes += sheetBytes;
  }

  if (totalBytes > WORKBOOK_LIMITS.maxWorkbookTotal) {
    throw new WorkbookError("workbook_too_large");
  }

  if (!ids.has(payload.primary_sheet_id)) {
    throw new WorkbookError("invalid_primary_sheet");
  }

  const attachmentOwners = new Map<string, string>();
  for (const sheet of payload.sheets) {
    for (const attId of sheet.attachment_ids ?? []) {
      const key = attId.toLowerCase();
      if (attachmentOwners.has(key)) {
        throw new WorkbookError("duplicate_attachment_id");
      }
      attachmentOwners.set(key, sheet.sheet_id);
    }
  }
}

export function getSheetById(payload: WorkbookPayload, sheetId: string): WorkbookSheet | undefined {
  return payload.sheets.find((s) => s.sheet_id === sheetId);
}

export function getOrderedSheets(payload: WorkbookPayload): WorkbookSheet[] {
  return sortedSheets(payload.sheets);
}

export function getActiveSheetMarkdown(payload: WorkbookPayload, activeSheetId: string): string {
  return getSheetById(payload, activeSheetId)?.markdown ?? "";
}

export function updateActiveSheetMarkdown(
  payload: WorkbookPayload,
  activeSheetId: string,
  markdown: string,
): WorkbookPayload {
  const ts = nowIso();
  return {
    ...payload,
    sheets: payload.sheets.map((s) =>
      s.sheet_id === activeSheetId ? { ...s, markdown, updated_at: ts } : s,
    ),
  };
}

export function resolveInitialSheetId(
  payload: WorkbookPayload,
  preferredId: string | null | undefined,
): string {
  if (preferredId && getSheetById(payload, preferredId)) return preferredId;
  if (getSheetById(payload, payload.primary_sheet_id)) return payload.primary_sheet_id;
  return getOrderedSheets(payload)[0]?.sheet_id ?? payload.primary_sheet_id;
}

export function nextDefaultSheetTitle(payload: WorkbookPayload): string {
  const existing = new Set(payload.sheets.map((s) => s.title));
  for (let i = 2; i <= WORKBOOK_LIMITS.maxSheets + 1; i++) {
    const candidate = `Sheet ${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return "Untitled";
}

export function addSheet(payload: WorkbookPayload): WorkbookPayload {
  if (payload.sheets.length >= WORKBOOK_LIMITS.maxSheets) {
    throw new WorkbookError("too_many_sheets");
  }
  const ts = nowIso();
  const maxOrder = Math.max(-1, ...payload.sheets.map((s) => s.order));
  const sheet: WorkbookSheet = {
    sheet_id: newSheetId(),
    title: nextDefaultSheetTitle(payload),
    order: maxOrder + 1,
    markdown: "",
    created_at: ts,
    updated_at: ts,
  };
  return { ...payload, sheets: [...payload.sheets, sheet] };
}

export function renameSheet(
  payload: WorkbookPayload,
  sheetId: string,
  title: string,
): WorkbookPayload {
  const trimmed = title.trim().slice(0, WORKBOOK_LIMITS.maxTitleLength);
  if (!trimmed) return payload;
  const ts = nowIso();
  return {
    ...payload,
    sheets: payload.sheets.map((s) =>
      s.sheet_id === sheetId ? { ...s, title: trimmed, updated_at: ts } : s,
    ),
  };
}

export function deleteSheet(payload: WorkbookPayload, sheetId: string): WorkbookPayload {
  if (payload.sheets.length <= 1) {
    throw new WorkbookError("empty_workbook");
  }
  const remaining = payload.sheets.filter((s) => s.sheet_id !== sheetId);
  const primary_sheet_id =
    payload.primary_sheet_id === sheetId ? remaining[0].sheet_id : payload.primary_sheet_id;
  return {
    ...payload,
    primary_sheet_id,
    sheets: remaining.map((s, i) => ({ ...s, order: i })),
  };
}

export function reorderSheets(payload: WorkbookPayload, orderedIds: string[]): WorkbookPayload {
  if (orderedIds.length !== payload.sheets.length) return payload;
  const byId = new Map(payload.sheets.map((s) => [s.sheet_id, s]));
  const reordered: WorkbookSheet[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const sheet = byId.get(orderedIds[i]);
    if (!sheet) return payload;
    reordered.push({ ...sheet, order: i });
  }
  return { ...payload, sheets: reordered };
}

export function pickAdjacentSheetId(payload: WorkbookPayload, deletedId: string): string {
  const ordered = getOrderedSheets(payload);
  const idx = ordered.findIndex((s) => s.sheet_id === deletedId);
  if (idx === -1) return ordered[0]?.sheet_id ?? payload.primary_sheet_id;
  const neighbor = ordered[idx + 1] ?? ordered[idx - 1];
  return neighbor?.sheet_id ?? ordered[0].sheet_id;
}

const ATT_REF_RE = new RegExp(
  `${KODAMA_ATT_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([0-9a-f-]{36})`,
  "gi",
);

/** Parse `kodama-att:` IDs from one sheet's markdown. */
export function collectSheetAttachmentRefs(markdown: string): Set<string> {
  const ids = new Set<string>();
  for (const m of markdown.matchAll(ATT_REF_RE)) {
    if (m[1]) ids.add(m[1].toLowerCase());
  }
  return ids;
}

/** True when a sheet may have files on the server (reference uploads or inline images). */
export function sheetUsesAttachments(sheet: WorkbookSheet): boolean {
  if ((sheet.attachment_ids?.length ?? 0) > 0) return true;
  return collectSheetAttachmentRefs(sheet.markdown).size > 0;
}

/** True when any sheet in the workbook may need attachment metadata from the server. */
export function workbookUsesAttachments(payload: WorkbookPayload): boolean {
  return payload.sheets.some(sheetUsesAttachments);
}

export function getSheetAttachmentIds(sheet: WorkbookSheet): Set<string> {
  const ids = new Set<string>();
  for (const id of sheet.attachment_ids ?? []) {
    ids.add(id.toLowerCase());
  }
  return ids;
}

export function getSheetAttachmentIdsForDelete(
  payload: WorkbookPayload,
  sheetId: string,
): string[] {
  const sheet = getSheetById(payload, sheetId);
  return sheet?.attachment_ids ? [...sheet.attachment_ids] : [];
}

function findSheetOwningAttachment(
  payload: WorkbookPayload,
  attId: string,
): string | undefined {
  const key = attId.toLowerCase();
  for (const sheet of payload.sheets) {
    if (getSheetAttachmentIds(sheet).has(key)) return sheet.sheet_id;
  }
  return undefined;
}

export function addSheetAttachment(
  payload: WorkbookPayload,
  sheetId: string,
  attachmentId: string,
): WorkbookPayload {
  const owner = findSheetOwningAttachment(payload, attachmentId);
  if (owner && owner !== sheetId) {
    throw new WorkbookError("duplicate_attachment_id");
  }
  const ts = nowIso();
  return {
    ...payload,
    sheets: payload.sheets.map((s) => {
      if (s.sheet_id !== sheetId) return s;
      const ids = [...(s.attachment_ids ?? [])];
      if (!ids.some((id) => id.toLowerCase() === attachmentId.toLowerCase())) {
        ids.push(attachmentId);
      }
      return { ...s, attachment_ids: ids, updated_at: ts };
    }),
  };
}

export function exportWorkbookMarkdown(payload: WorkbookPayload): string {
  return getOrderedSheets(payload)
    .map((s) => `# Sheet: ${s.title}\n\n${s.markdown.trim()}`)
    .join("\n\n---\n\n");
}

export const LAST_SHEET_KEY = (slug: string) => `kodama-sheet-${slug}`;

export function readLastOpenedSheet(slug: string): string | null {
  try {
    return localStorage.getItem(LAST_SHEET_KEY(slug));
  } catch {
    return null;
  }
}

export function writeLastOpenedSheet(slug: string, sheetId: string) {
  try {
    localStorage.setItem(LAST_SHEET_KEY(slug), sheetId);
  } catch {
    /* ignore */
  }
}
