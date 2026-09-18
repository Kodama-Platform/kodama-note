// Client-side data access for the encrypted pages backend.
//
// Zero-knowledge contract (KNP-1):
// - Password and private keys never leave the browser.
// - Delivery Gate (https://api.kodama.com/v1/notes) stores ciphertext + public meta only.
import { createNoteApiDeliveryClient } from "@/lib/note-delivery-client";
import {
  NoteApiError,
  isMissingPlaceError,
  noteApiGetBlob,
  noteApiJson,
  noteApiPutBlob,
  noteResourceUrl,
} from "@/lib/note-api";
import {
  defaultNoteEntitlement,
  defaultNotePaymentPublic,
  parseNoteEntitlement,
  parseNotePaymentPublic,
  type NotePlaceEntitlement,
  type NotePlacePaymentPublic,
} from "@/lib/note-payment";
import { parseNotePlaceSettings, type NotePlaceSettings } from "@/lib/note-place-settings";
import { getPlacePublicView } from "@/lib/note-tabs-api";
import { parsePlacePublicView, type PublicTabRecord } from "@/lib/tab-visibility";

export type SerializableKdfParams =
  | {
      algo: string;
      m: number;
      t: number;
      p: number;
      version: number;
    }
  | Record<string, unknown>;

export type BurnMode = "never" | "after_read" | "1h" | "24h" | "7d";

export const BURN_MODES: { value: BurnMode; label: string; hint: string }[] = [
  { value: "never", label: "Never expires", hint: "Keep forever" },
  { value: "after_read", label: "Burn after first read", hint: "Self-destructs once opened" },
  { value: "1h", label: "Expire in 1 hour", hint: "Auto-deleted after 1h" },
  { value: "24h", label: "Expire in 24 hours", hint: "Auto-deleted after 24h" },
  { value: "7d", label: "Expire in 7 days", hint: "Auto-deleted after 7d" },
];

export type PageRow = {
  id: string;
  slug: string;
  ciphertext: string;
  salt: string;
  iv: string;
  kdf_params: SerializableKdfParams;
  burn_mode: BurnMode;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  settings?: NotePlaceSettings | null;
  payment?: NotePlacePaymentPublic | null;
  entitlement?: NotePlaceEntitlement | null;
  paid_unlock_required?: boolean;
  title?: string;
  description?: string;
  public_tabs?: PublicTabRecord[];
};

export type GetPageResult = { exists: false } | ({ exists: true } & PageRow);

function parseJsonField(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

function hydratePageRow(row: Record<string, unknown>): Extract<GetPageResult, { exists: true }> {
  const rawKdf = parseJsonField(row.kdf_params ?? row.private_kdf_params);
  const slug = String(row.slug ?? "");
  const publicView = parsePlacePublicView(row, slug);
  return {
    exists: true,
    id: String(row.id ?? row.slug ?? ""),
    slug,
    ciphertext: (row.ciphertext as string) ?? "",
    iv: (row.iv as string) ?? "",
    salt: (row.salt as string) ?? "",
    kdf_params: (rawKdf ?? {}) as SerializableKdfParams,
    burn_mode: row.burn_mode as BurnMode,
    expires_at: (row.expires_at as string | null) ?? null,
    created_at: (row.created_at as string) ?? "",
    updated_at: (row.updated_at as string) ?? "",
    settings: parseNotePlaceSettings(row.settings),
    payment: parseNotePaymentPublic(row.payment, slug),
    entitlement: parseNoteEntitlement(row.entitlement, slug),
    paid_unlock_required: row.paid_unlock_required === true,
    title: publicView.title,
    description: publicView.description,
    public_tabs: publicView.tabs,
  };
}

function hydratePaidUnlockPage(
  slug: string,
  payload: Record<string, unknown> | undefined,
): Extract<GetPageResult, { exists: true }> {
  const row = { slug, ...(payload ?? {}), ciphertext: "", paid_unlock_required: true };
  const hydrated = hydratePageRow(row);
  return {
    ...hydrated,
    payment: hydrated.payment ?? defaultNotePaymentPublic(slug),
    entitlement: hydrated.entitlement ?? {
      ...defaultNoteEntitlement(slug),
      paid_unlock_required: true,
    },
    paid_unlock_required: true,
  };
}

export async function getPage(slug: string): Promise<GetPageResult> {
  try {
    const row = await noteApiJson<Record<string, unknown>>("GET", noteResourceUrl(slug));
    const hydrated = hydratePageRow(row);
    if ((hydrated.public_tabs?.length ?? 0) === 0) {
      try {
        const view = await getPlacePublicView(slug);
        if (view.tabs.length) {
          return {
            ...hydrated,
            title: view.title || hydrated.title,
            description: view.description || hydrated.description,
            public_tabs: view.tabs,
          };
        }
      } catch {
        /* public resource optional */
      }
    }
    return hydrated;
  } catch (error) {
    if (isMissingPlaceError(error)) return { exists: false };
    if (
      error instanceof NoteApiError &&
      (error.status === 402 || error.reason === "paid_unlock_required")
    ) {
      return hydratePaidUnlockPage(slug, error.payload);
    }
    throw error;
  }
}

export async function updateExpiry(args: {
  slug: string;
  burn_mode: BurnMode;
}): Promise<{ burn_mode: BurnMode; expires_at: string | null }> {
  const delivery = createNoteApiDeliveryClient();
  const res = await delivery.updateExpiry({
    kind: "note.updateExpiry",
    slug: args.slug,
    burnMode: args.burn_mode,
  });
  return { burn_mode: res.burn_mode as BurnMode, expires_at: res.expires_at };
}

export type AttachmentRow = {
  id: string;
  storage_path: string;
  iv: string;
  filename_ciphertext: string;
  filename_iv: string;
  mime: string;
  size: number;
  created_at: string;
};

export async function listAttachments(slug: string): Promise<AttachmentRow[]> {
  const data = await noteApiJson<AttachmentRow[] | { attachments?: AttachmentRow[]; items?: AttachmentRow[] }>(
    "GET",
    noteResourceUrl(slug, "attachments"),
  );
  if (Array.isArray(data)) return data;
  return data.attachments ?? data.items ?? [];
}

export async function registerAttachment(args: {
  slug: string;
  storage_path: string;
  iv: string;
  filename_ciphertext: string;
  filename_iv: string;
  mime: string;
  size: number;
}): Promise<{ id: string; created_at: string }> {
  const delivery = createNoteApiDeliveryClient();
  return delivery.publishEncryptedAttachment({
    kind: "note.publishAttachment",
    slug: args.slug,
    storagePath: args.storage_path,
    iv: args.iv,
    filenameCiphertext: args.filename_ciphertext,
    filenameIv: args.filename_iv,
    mime: args.mime,
    size: args.size,
  });
}

export async function deleteAttachment(args: {
  slug: string;
  attachment_id: string;
}): Promise<void> {
  const delivery = createNoteApiDeliveryClient();
  await delivery.deleteEncryptedAttachment({
    kind: "note.deleteAttachment",
    slug: args.slug,
    attachmentId: args.attachment_id,
  });
}

export async function uploadAttachmentBlob(path: string, blob: Blob): Promise<string> {
  const slug = path.split("/")[0] || path;
  const url = noteResourceUrl(slug, "files", path);
  await noteApiPutBlob(url, blob);
  return url;
}

export async function downloadAttachmentBlob(path: string): Promise<Blob> {
  const slug = path.split("/")[0] || path;
  return noteApiGetBlob(noteResourceUrl(slug, "files", path));
}

export async function deleteAttachmentBlob(path: string): Promise<void> {
  const slug = path.split("/")[0] || path;
  try {
    await noteApiJson("DELETE", noteResourceUrl(slug, "files", path));
  } catch (e) {
    if (e instanceof NoteApiError && e.status === 404) return;
    throw e;
  }
}
