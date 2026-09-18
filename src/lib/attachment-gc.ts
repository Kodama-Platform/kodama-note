import type { QueryClient } from "@tanstack/react-query";

import { fetchAttachmentList, invalidateAttachmentList } from "@/lib/attachment-list";
import { parseKodamaAttUrl } from "@/lib/kodama-image";
import { parseAttachmentStorageUrl } from "@/lib/note-api";
import {
  deleteAttachment,
  deleteAttachmentBlob,
  type AttachmentRow,
} from "@/lib/pages";
import type { WorkbookPayload, WorkbookSheet } from "@/lib/workbook";

const MD_IMAGE_RE = /!\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g;

export function collectMarkdownImageSrcs(markdown: string): string[] {
  const srcs: string[] = [];
  for (const match of markdown.matchAll(MD_IMAGE_RE)) {
    let src = match[1] ?? "";
    if (src.startsWith("<") && src.endsWith(">")) src = src.slice(1, -1);
    src = src.replace(/\\([()])/g, "$1");
    if (src) srcs.push(src);
  }
  return srcs;
}

export function referencedAttachmentIdsForSheet(
  sheet: WorkbookSheet,
  rows: readonly AttachmentRow[],
): Set<string> {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const src of collectMarkdownImageSrcs(sheet.markdown)) {
    const attId = parseKodamaAttUrl(src);
    if (attId) ids.add(attId.toLowerCase());
    const path = parseAttachmentStorageUrl(src);
    if (path) paths.add(path);
  }
  for (const row of rows) {
    if (paths.has(row.storage_path)) ids.add(row.id.toLowerCase());
  }
  return ids;
}

export function unusedAttachmentIds(
  payload: WorkbookPayload,
  rows: readonly AttachmentRow[],
): AttachmentRow[] {
  const referenced = new Set<string>();
  for (const sheet of payload.sheets) {
    for (const id of referencedAttachmentIdsForSheet(sheet, rows)) referenced.add(id);
  }
  return rows.filter((row) => !referenced.has(row.id.toLowerCase()));
}

export function pruneWorkbookAttachmentIds(
  payload: WorkbookPayload,
  rows: readonly AttachmentRow[],
): WorkbookPayload {
  const ts = new Date().toISOString();
  let changed = false;
  const sheets = payload.sheets.map((sheet) => {
    const keep = [...referencedAttachmentIdsForSheet(sheet, rows)];
    const prev = sheet.attachment_ids ?? [];
    const same =
      prev.length === keep.length &&
      prev.every((id, i) => id.toLowerCase() === keep[i]);
    if (same) return sheet;
    changed = true;
    const next = { ...sheet, updated_at: ts };
    if (keep.length) next.attachment_ids = keep;
    else delete next.attachment_ids;
    return next;
  });
  return changed ? { ...payload, sheets } : payload;
}

async function deleteStoredAttachment(slug: string, row: AttachmentRow): Promise<void> {
  await deleteAttachment({ slug, attachment_id: row.id });
  try {
    await deleteAttachmentBlob(row.storage_path);
  } catch {
    /* metadata delete may already have removed the blob */
  }
}

/** Drop storage objects that are no longer referenced in the workbook, then prune ids. */
export async function purgeUnusedAttachments(
  slug: string,
  payload: WorkbookPayload,
  queryClient?: QueryClient,
): Promise<WorkbookPayload> {
  let rows: AttachmentRow[] = [];
  try {
    rows = await fetchAttachmentList(slug);
  } catch {
    return payload;
  }
  const unused = unusedAttachmentIds(payload, rows);
  if (unused.length) {
    await Promise.allSettled(unused.map((row) => deleteStoredAttachment(slug, row)));
    invalidateAttachmentList(slug, queryClient);
    rows = rows.filter((row) => !unused.some((u) => u.id === row.id));
  }
  return pruneWorkbookAttachmentIds(payload, rows);
}
