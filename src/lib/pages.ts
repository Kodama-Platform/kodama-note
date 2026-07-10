// Client-side data access for the encrypted pages backend.
//
// Zero-knowledge contract:
// - User password → Argon2id key derivation + AES-GCM encryption in the browser only.
// - Supabase stores ciphertext, salt, IV, and KDF params — never the password or plaintext.
// - edit_token gates writes; view_token is stored server-side but unused client-side.
import { supabase } from "@/integrations/supabase/client";
import { normalizeKdfParams } from "@/lib/crypto";
import { VERSIONING_ENABLED } from "@/lib/features";
import { assertNoSecretsInPayload } from "@/lib/server-payload";

// Generated Supabase types don't yet include our custom RPCs — call untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => {
  if (args) assertNoSecretsInPayload(args, name);
  return (supabase.rpc as any)(name, args);
};

export type SerializableKdfParams = {
  algo: string;
  m: number;
  t: number;
  p: number;
  version: number;
};

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
};

export type GetPageResult = { exists: false } | ({ exists: true } & PageRow);

export type VersionRow = { id: string; ciphertext: string; iv: string; created_at: string };

function latestVersionSnapshot(
  pageCiphertext: string,
  pageIv: string,
  versions: VersionRow[],
): { ciphertext: string; iv: string } {
  if (versions.length === 0) {
    return { ciphertext: pageCiphertext, iv: pageIv };
  }
  const latest = [...versions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
  return { ciphertext: latest.ciphertext, iv: latest.iv };
}

export async function getPage(slug: string): Promise<GetPageResult> {
  const { data, error } = await rpc("kodama_read_page", { p_slug: slug });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { exists: false };
  return hydratePageRow(row, slug);
}

/** Lightweight availability probe for the landing-page slug field. */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const result = await getPage(slug);
  return !result.exists;
}

async function hydratePageRow(
  row: Record<string, unknown>,
  slug: string,
): Promise<Extract<GetPageResult, { exists: true }>> {
  let ciphertext = row.ciphertext as string;
  let iv = row.iv as string;

  if (VERSIONING_ENABLED) {
    let versions: VersionRow[] = [];
    try {
      versions = await listVersions(slug);
    } catch {
      /* fall back to page row ciphertext */
    }
    ({ ciphertext, iv } = latestVersionSnapshot(ciphertext, iv, versions));
  }

  return {
    exists: true,
    id: row.id as string,
    slug: row.slug as string,
    ciphertext,
    iv,
    salt: row.salt as string,
    kdf_params: normalizeKdfParams(row.kdf_params),
    burn_mode: row.burn_mode as BurnMode,
    expires_at: row.expires_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export type CreatePageInput = {
  slug: string;
  /** AES-GCM ciphertext produced by encrypt() in the browser — never plaintext. */
  ciphertext: string;
  salt: string;
  iv: string;
  kdf_params: SerializableKdfParams;
  burn_mode: BurnMode;
};

export type CreatePageResult =
  | { ok: true; edit_token: string; view_token: string; expires_at: string | null }
  | { ok: false; reason: "slug_taken" };

export async function createPage(input: CreatePageInput): Promise<CreatePageResult> {
  const { data, error } = await rpc("kodama_create_page", {
    p_slug: input.slug,
    p_ciphertext: input.ciphertext,
    p_salt: input.salt,
    p_iv: input.iv,
    p_kdf_params: input.kdf_params,
    p_burn_mode: input.burn_mode,
  });
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { ok: false, reason: "slug_taken" };
    }
    throw new Error(error.message);
  }
  const row = data as { edit_token: string; view_token: string; expires_at: string | null };
  return {
    ok: true,
    edit_token: row.edit_token,
    view_token: row.view_token,
    expires_at: row.expires_at,
  };
}

export async function appendVersion(args: {
  slug: string;
  edit_token: string;
  ciphertext: string;
  iv: string;
}): Promise<{ id: string; created_at: string }> {
  const { data, error } = await rpc("kodama_append_version", {
    p_slug: args.slug,
    p_edit_token: args.edit_token,
    p_ciphertext: args.ciphertext,
    p_iv: args.iv,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; created_at: string };
}

/** Save encrypted page content. Uses append RPC until in-place update is available. */
export async function savePage(args: {
  slug: string;
  edit_token: string;
  ciphertext: string;
  iv: string;
}): Promise<{ id: string; created_at: string }> {
  return appendVersion(args);
}

export async function updateExpiry(args: {
  slug: string;
  edit_token: string;
  burn_mode: BurnMode;
}): Promise<{ burn_mode: BurnMode; expires_at: string | null }> {
  const { data, error } = await rpc("kodama_update_expiry", {
    p_slug: args.slug,
    p_edit_token: args.edit_token,
    p_burn_mode: args.burn_mode,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    burn_mode: row.burn_mode as BurnMode,
    expires_at: row.expires_at,
  };
}

export async function listVersions(slug: string): Promise<VersionRow[]> {
  const { data, error } = await rpc("kodama_list_versions", { p_slug: slug });
  if (error) throw new Error(error.message);
  return (data ?? []) as VersionRow[];
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
  const { data, error } = await rpc("kodama_list_attachments", { p_slug: slug });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttachmentRow[];
}

export async function registerAttachment(args: {
  slug: string;
  edit_token: string;
  storage_path: string;
  iv: string;
  filename_ciphertext: string;
  filename_iv: string;
  mime: string;
  size: number;
}): Promise<{ id: string; created_at: string }> {
  const { data, error } = await rpc("kodama_register_attachment", {
    p_slug: args.slug,
    p_edit_token: args.edit_token,
    p_storage_path: args.storage_path,
    p_iv: args.iv,
    p_filename_ciphertext: args.filename_ciphertext,
    p_filename_iv: args.filename_iv,
    p_mime: args.mime,
    p_size: args.size,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; created_at: string };
}

export async function deleteAttachment(args: {
  slug: string;
  edit_token: string;
  attachment_id: string;
}): Promise<void> {
  const { error } = await rpc("kodama_delete_attachment", {
    p_slug: args.slug,
    p_edit_token: args.edit_token,
    p_attachment_id: args.attachment_id,
  });
  if (error) throw new Error(error.message);
}

export async function uploadAttachmentBlob(path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage
    .from("page-attachments")
    .upload(path, blob, { contentType: "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
}

export async function downloadAttachmentBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from("page-attachments").download(path);
  if (error) throw new Error(error.message);
  return data;
}
