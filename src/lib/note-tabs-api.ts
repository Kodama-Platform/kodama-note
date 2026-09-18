import { NoteApiError, noteApiJson, noteResourceUrl } from "@/lib/note-api";
import type { NoteSession } from "@/lib/note-protocol";
import { signPlaceDocument, signPlaceWrite } from "@/lib/place-meta-sign";
import {
  parsePlacePublicView,
  publicSheetsOf,
  workbookToPublicTabDocument,
  type PlacePublicView,
  type PublicTabRecord,
} from "@/lib/tab-visibility";
import type { WorkbookPayload, WorkbookSheet } from "@/lib/workbook";

export const KNP_PUBLIC_TAB_CREATE = "knp-public-tab-create-1";
export const KNP_PUBLIC_TAB_PUT = "knp-public-tab-put-1";
export const KNP_PUBLIC_TAB_DELETE = "knp-public-tab-delete-1";
export const KNP_PUBLIC_TAB_PUBLISH = "knp-public-tab-publish-1";
export const KNP_PUBLIC_TAB_UNPUBLISH = "knp-public-tab-unpublish-1";

export async function getPlacePublicView(slug: string): Promise<PlacePublicView> {
  try {
    const row = await noteApiJson<unknown>("GET", noteResourceUrl(slug, "public"));
    return parsePlacePublicView(row, slug);
  } catch (error) {
    if (error instanceof NoteApiError && error.status === 404) {
      return { slug, title: "", description: "", tabs: [] };
    }
    throw error;
  }
}

export async function putPublicTab(args: {
  slug: string;
  sheet: WorkbookSheet;
  displayOrder: number;
  session: NoteSession;
}): Promise<PublicTabRecord> {
  const document = {
    visibility: "public",
    ...workbookToPublicTabDocument(args.sheet, args.displayOrder),
    issued_at: new Date().toISOString(),
  };
  const exists = typeof args.sheet.revision === "number";
  const purpose = exists ? KNP_PUBLIC_TAB_PUT : KNP_PUBLIC_TAB_CREATE;
  const signed = await signPlaceWrite({
    session: args.session,
    slug: args.slug,
    purpose,
    document,
  });
  const path = exists
    ? noteResourceUrl(args.slug, "tabs", args.sheet.sheet_id)
    : noteResourceUrl(args.slug, "tabs");
  const method = exists ? "PUT" : "POST";
  const row = await noteApiJson<unknown>(method, path, {
    ...document,
    ...signed,
  });
  const parsed = parsePlacePublicView({ tabs: [row] }, args.slug).tabs[0];
  if (parsed) return parsed;
  return {
    id: args.sheet.sheet_id,
    public_slug: document.public_slug,
    title: document.title,
    content_markdown: document.content_markdown,
    display_order: document.display_order,
    revision: (args.sheet.revision ?? 0) + 1,
  };
}

export async function deletePublicTab(args: {
  slug: string;
  tabId: string;
  session: NoteSession;
}): Promise<void> {
  const document = { tab_id: args.tabId, issued_at: new Date().toISOString() };
  const signed = await signPlaceWrite({
    session: args.session,
    slug: args.slug,
    purpose: KNP_PUBLIC_TAB_DELETE,
    document,
  });
  try {
    await noteApiJson("DELETE", noteResourceUrl(args.slug, "tabs", args.tabId), {
      ...document,
      ...signed,
    });
  } catch (error) {
    if (error instanceof NoteApiError && error.status === 404) return;
    throw error;
  }
}

export async function publishTab(args: {
  slug: string;
  sheet: WorkbookSheet;
  displayOrder: number;
  session: NoteSession;
}): Promise<PublicTabRecord> {
  const public_tab = workbookToPublicTabDocument(args.sheet, args.displayOrder);
  const document = {
    public_tab,
    issued_at: new Date().toISOString(),
  };
  const signed = await signPlaceDocument({
    session: args.session,
    slug: args.slug,
    purpose: KNP_PUBLIC_TAB_PUBLISH,
    document,
  });
  const row = await noteApiJson<unknown>(
    "POST",
    noteResourceUrl(args.slug, "tabs", args.sheet.sheet_id, "publish"),
    {
      ...document,
      ...signed,
    },
  );
  return (
    parsePlacePublicView({ tabs: [row] }, args.slug).tabs[0] ?? {
      id: args.sheet.sheet_id,
      ...public_tab,
      revision: 1,
    }
  );
}

export async function persistPublicSheets(args: {
  slug: string;
  workbook: WorkbookPayload;
  session: NoteSession;
}): Promise<WorkbookPayload> {
  const publicSheets = publicSheetsOf(args.workbook);
  if (!publicSheets.length) return args.workbook;
  const updated = new Map<string, PublicTabRecord>();
  for (const [index, sheet] of publicSheets.entries()) {
    const saved = await putPublicTab({
      slug: args.slug,
      sheet,
      displayOrder: sheet.order ?? index,
      session: args.session,
    });
    updated.set(sheet.sheet_id, saved);
  }
  return {
    ...args.workbook,
    sheets: args.workbook.sheets.map((sheet) => {
      const saved = updated.get(sheet.sheet_id);
      if (!saved) return sheet;
      return {
        ...sheet,
        visibility: "public" as const,
        public_slug: saved.public_slug,
        revision: saved.revision,
        title: saved.title,
      };
    }),
  };
}

export async function unpublishTab(args: {
  slug: string;
  tabId: string;
  session: NoteSession;
}): Promise<void> {
  const document = { issued_at: new Date().toISOString() };
  const signed = await signPlaceDocument({
    session: args.session,
    slug: args.slug,
    purpose: KNP_PUBLIC_TAB_UNPUBLISH,
    document,
  });
  try {
    await noteApiJson("POST", noteResourceUrl(args.slug, "tabs", args.tabId, "unpublish"), {
      ...document,
      ...signed,
    });
  } catch (error) {
    if (error instanceof NoteApiError && error.status === 404) return;
    throw error;
  }
}
