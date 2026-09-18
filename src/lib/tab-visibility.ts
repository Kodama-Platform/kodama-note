import {
  createEmptyWorkbook,
  getOrderedSheets,
  getSheetById,
  sheetUsesAttachments,
  type TabVisibility,
  type WorkbookPayload,
  type WorkbookSheet,
} from "@/lib/workbook";

export const UNPUBLISH_WARNING =
  "This tab will no longer be available through Kodama. Copies previously downloaded, indexed or archived cannot be removed.";

export type PublicTabRecord = {
  id: string;
  public_slug: string;
  title: string;
  description?: string;
  content_markdown: string;
  display_order: number;
  revision: number;
};

export type PlacePublicView = {
  slug: string;
  title: string;
  description: string;
  tabs: PublicTabRecord[];
};

/** Server-safe public GET must never mention private tabs. */
export const PRIVATE_LEAK_KEYS = [
  "private_tabs",
  "private_tab_count",
  "private_titles",
  "ciphertext",
  "private_ciphertext",
  "private_nonce",
  "private_salt",
] as const;

export function sheetVisibility(sheet: WorkbookSheet): TabVisibility {
  return sheet.visibility === "public" ? "public" : "private";
}

export function isPublicSheet(sheet: WorkbookSheet): boolean {
  return sheetVisibility(sheet) === "public";
}

export function slugifyTabTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "tab";
}

export function uniquePublicSlug(
  payload: WorkbookPayload,
  title: string,
  sheetId: string,
): string {
  const base = slugifyTabTitle(title);
  const taken = new Set(
    payload.sheets
      .filter((s) => s.sheet_id !== sheetId && isPublicSheet(s) && s.public_slug)
      .map((s) => s.public_slug as string),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`.slice(0, 48);
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${sheetId.slice(0, 8)}`;
}

export function parsePublicTabRecord(raw: unknown, index: number): PublicTabRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id =
    (typeof row.tab_id === "string" && row.tab_id) ||
    (typeof row.id === "string" && row.id) ||
    (typeof row.sheet_id === "string" && row.sheet_id) ||
    "";
  if (!id) return null;
  const title = typeof row.title === "string" ? row.title : "";
  const markdown =
    (typeof row.content_markdown === "string" && row.content_markdown) ||
    (typeof row.markdown === "string" && row.markdown) ||
    (typeof row.content === "string" && row.content) ||
    "";
  const public_slug =
    typeof row.public_slug === "string" && row.public_slug
      ? row.public_slug
      : slugifyTabTitle(title || id);
  const display_order =
    typeof row.display_order === "number"
      ? row.display_order
      : typeof row.order === "number"
        ? row.order
        : index;
  const revision = typeof row.revision === "number" ? row.revision : 1;
  const description = typeof row.description === "string" ? row.description : undefined;
  return { id, public_slug, title, description, content_markdown: markdown, display_order, revision };
}

export function parsePlacePublicView(raw: unknown, fallbackSlug = ""): PlacePublicView {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const nested = row.public && typeof row.public === "object" ? (row.public as Record<string, unknown>) : row;
  const tabsRaw = Array.isArray(row.tabs)
    ? row.tabs
    : Array.isArray(row.public_tabs)
      ? row.public_tabs
      : Array.isArray(nested.tabs)
        ? nested.tabs
        : [];
  const tabs = tabsRaw
    .map((item, i) => parsePublicTabRecord(item, i))
    .filter((item): item is PublicTabRecord => !!item);
  return {
    slug: String(row.slug ?? fallbackSlug),
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : "",
    tabs,
  };
}

export function publicTabsToWorkbook(tabs: PublicTabRecord[]): WorkbookPayload {
  if (!tabs.length) {
    return { schema_version: 1, primary_sheet_id: "", sheets: [] };
  }
  const sheets: WorkbookSheet[] = tabs
    .slice()
    .sort((a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title))
    .map((tab, i) => ({
      sheet_id: tab.id,
      title: tab.title,
      order: tab.display_order ?? i,
      markdown: tab.content_markdown,
      visibility: "public" as const,
      public_slug: tab.public_slug,
      revision: tab.revision,
    }));
  return {
    schema_version: 1,
    primary_sheet_id: sheets[0].sheet_id,
    sheets,
  };
}

export function privateSheetsOf(payload: WorkbookPayload): WorkbookSheet[] {
  return payload.sheets.filter((s) => !isPublicSheet(s));
}

export function publicSheetsOf(payload: WorkbookPayload): WorkbookSheet[] {
  return payload.sheets.filter(isPublicSheet);
}

/** Envelope payload: private tabs only. Empty is allowed. */
export function privateWorkbookFrom(payload: WorkbookPayload): WorkbookPayload {
  const sheets = privateSheetsOf(payload).map((sheet) => {
    const next: WorkbookSheet = {
      sheet_id: sheet.sheet_id,
      title: sheet.title,
      order: sheet.order,
      markdown: sheet.markdown,
      visibility: "private",
    };
    if (sheet.attachment_ids?.length) next.attachment_ids = sheet.attachment_ids;
    if (sheet.created_at) next.created_at = sheet.created_at;
    if (sheet.updated_at) next.updated_at = sheet.updated_at;
    return next;
  });
  const primary =
    sheets.find((s) => s.sheet_id === payload.primary_sheet_id)?.sheet_id ??
    sheets[0]?.sheet_id ??
    "";
  return { schema_version: 1, primary_sheet_id: primary, sheets };
}

export function mergePublicAndPrivate(
  publicView: PlacePublicView | PublicTabRecord[] | WorkbookPayload,
  privatePayload: WorkbookPayload,
): WorkbookPayload {
  const publicWb = Array.isArray(publicView)
    ? publicTabsToWorkbook(publicView)
    : "tabs" in publicView
      ? publicTabsToWorkbook(publicView.tabs)
      : publicView;
  const publicSheets = publicSheetsOf(publicWb);
  const privateSheets = privateSheetsOf(privatePayload);
  const sheets = [...publicSheets, ...privateSheets];
  if (!sheets.length) return createEmptyWorkbook();
  const seen = new Set<string>();
  const unique = sheets.filter((s) => {
    if (seen.has(s.sheet_id)) return false;
    seen.add(s.sheet_id);
    return true;
  });
  const ordered = unique
    .slice()
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((s, i) => ({ ...s, order: i }));
  const primary =
    ordered.find((s) => s.sheet_id === publicWb.primary_sheet_id)?.sheet_id ??
    ordered.find((s) => s.sheet_id === privatePayload.primary_sheet_id)?.sheet_id ??
    ordered[0].sheet_id;
  return { schema_version: 1, primary_sheet_id: primary, sheets: ordered };
}

export function setSheetVisibility(
  payload: WorkbookPayload,
  sheetId: string,
  visibility: TabVisibility,
): WorkbookPayload {
  const sheet = getSheetById(payload, sheetId);
  if (!sheet) return payload;
  const public_slug =
    visibility === "public" ? uniquePublicSlug(payload, sheet.title, sheetId) : undefined;
  return {
    ...payload,
    sheets: payload.sheets.map((s) =>
      s.sheet_id === sheetId
        ? {
            ...s,
            visibility,
            public_slug,
            revision: visibility === "public" ? s.revision : undefined,
          }
        : s,
    ),
  };
}

export function sheetHasPrivateAttachments(sheet: WorkbookSheet): boolean {
  return sheetUsesAttachments(sheet);
}

export function canMakeSheetPublic(sheet: WorkbookSheet): boolean {
  return sheetVisibility(sheet) === "private" && !sheetHasPrivateAttachments(sheet);
}

export function resolveSheetRef(
  payload: WorkbookPayload,
  ref: string | null | undefined,
): string | undefined {
  if (!ref) return undefined;
  if (getSheetById(payload, ref)) return ref;
  const bySlug = payload.sheets.find((s) => s.public_slug === ref);
  return bySlug?.sheet_id;
}

export function publicPayloadLeaksPrivate(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const keys = Object.keys(value as Record<string, unknown>);
  return PRIVATE_LEAK_KEYS.filter((key) => keys.includes(key));
}

export function workbookToPublicTabDocument(sheet: WorkbookSheet, displayOrder: number) {
  return {
    tab_id: sheet.sheet_id,
    public_slug: sheet.public_slug || slugifyTabTitle(sheet.title),
    title: sheet.title,
    content_markdown: sheet.markdown,
    display_order: displayOrder,
  };
}

export function orderedPublicDisplay(payload: WorkbookPayload): WorkbookSheet[] {
  return getOrderedSheets(payload).filter(isPublicSheet);
}
