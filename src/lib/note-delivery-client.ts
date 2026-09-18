import { base64ToBytes } from "@kodama.page/core";

import type {
  AppendProtectedNoteCommand,
  DeleteAttachmentCommand,
  KnpPlaceMeta,
  NoteDeliveryClient,
  PublishAttachmentCommand,
  PublishProtectedNoteCommand,
  UpdateExpiryCommand,
} from "@/lib/note-protocol";
import { NoteApiError, isMissingPlaceError, noteApiBaseUrl, noteApiJson, noteResourceUrl } from "@/lib/note-api";
import { createPlaceDocument, savePrivateDocument } from "@/lib/note-gate-body";

function isMeta(value: unknown): value is KnpPlaceMeta {
  return (
    !!value &&
    typeof value === "object" &&
    (value as KnpPlaceMeta).protocol === "knp-1" &&
    (value as KnpPlaceMeta).storage_mode === "knp-envelope"
  );
}

function parseMeta(raw: unknown): KnpPlaceMeta {
  let meta = raw;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta) as unknown;
    } catch {
      throw new Error("not a KNP-1 note");
    }
  }
  if (!isMeta(meta)) throw new Error("not a KNP-1 note");
  return meta;
}

type NoteRow = {
  slug?: string;
  ciphertext?: string;
  private_ciphertext?: string;
  salt?: string;
  private_salt?: string;
  kdf_params?: unknown;
  private_kdf_params?: unknown;
  burn_mode?: string;
  expires_at?: string | null;
  updated_at?: string;
  private?: NoteRow;
};

function flattenNoteRow(row: NoteRow): NoteRow {
  const nested = row.private;
  return {
    slug: row.slug ?? nested?.slug,
    ciphertext: row.ciphertext ?? row.private_ciphertext ?? nested?.ciphertext ?? nested?.private_ciphertext,
    salt: row.salt ?? row.private_salt ?? nested?.salt ?? nested?.private_salt,
    kdf_params: row.kdf_params ?? row.private_kdf_params ?? nested?.kdf_params ?? nested?.private_kdf_params,
    burn_mode: row.burn_mode ?? nested?.burn_mode,
    expires_at: row.expires_at ?? nested?.expires_at,
    updated_at: row.updated_at ?? nested?.updated_at,
  };
}

function hasPrivateEnvelope(row: NoteRow): boolean {
  const ciphertext = row.ciphertext ?? row.private_ciphertext;
  const kdf = row.kdf_params ?? row.private_kdf_params;
  return typeof ciphertext === "string" && ciphertext.length > 0 && kdf != null;
}

/** Delivery Gate create allowlist — never send KNP `version` or the state-header sig. */
export function createPlaceRequestBody(command: PublishProtectedNoteCommand): Record<string, unknown> {
  if (!command.gateSignatureB64) {
    throw new Error("create place requires a Gate CBOR signature");
  }
  return {
    ...createPlaceDocument(command),
    owner_public_key: command.meta.owner_public_key,
    state_signature: command.gateSignatureB64,
  };
}

/** Delivery Gate private-save allowlist — no expected_version / history fields. */
export function savePrivateRequestBody(command: AppendProtectedNoteCommand): Record<string, unknown> {
  if (!command.gateSignatureB64) {
    throw new Error("private save requires a Gate CBOR signature");
  }
  return {
    ...savePrivateDocument(command),
    writer_public_key: command.writerPublicKeyB64,
    state_signature: command.gateSignatureB64,
  };
}

/** HTTP Delivery Gate client — `{VITE_BACKEND_URL}/v1/notes` (see docs/NOTE_API.md). */
export function createNoteApiDeliveryClient(): NoteDeliveryClient {
  return {
    async publishProtectedNote(command: PublishProtectedNoteCommand) {
      try {
        const result = await noteApiJson<{ expires_at?: string | null }>(
          "POST",
          noteApiBaseUrl(),
          createPlaceRequestBody(command),
        );
        return { expires_at: result.expires_at ?? null };
      } catch (error) {
        if (error instanceof NoteApiError && error.reason === "slug_taken") {
          throw new Error("slug_taken");
        }
        throw error;
      }
    },

    async appendProtectedNote(command: AppendProtectedNoteCommand) {
      const body = Object.fromEntries(
        Object.entries(savePrivateRequestBody(command)).filter(([, value]) => value !== undefined),
      );
      try {
        await noteApiJson("PUT", noteResourceUrl(command.slug, "private"), body);
      } catch (error) {
        if (!(error instanceof NoteApiError && error.status === 404)) throw error;
        await noteApiJson("PUT", noteResourceUrl(command.slug), body);
      }
    },

    async fetchProtectedNote(slug: string) {
      const readRow = (row: NoteRow) => {
        const flat = flattenNoteRow(row);
        return {
          exists: true as const,
          slug: flat.slug ?? slug,
          noteEnvelope: base64ToBytes(String(flat.ciphertext ?? "")),
          saltB64: String(flat.salt ?? ""),
          meta: parseMeta(flat.kdf_params),
          burnMode: String(flat.burn_mode ?? "never"),
          expiresAt: flat.expires_at ?? null,
          updatedAt: String(flat.updated_at ?? ""),
        };
      };
      try {
        const row = flattenNoteRow(await noteApiJson<NoteRow>("GET", noteResourceUrl(slug, "private")));
        if (hasPrivateEnvelope(row)) return readRow(row);
      } catch (error) {
        if (!isMissingPlaceError(error) && !(error instanceof NoteApiError && error.status === 405)) {
          throw error;
        }
      }
      try {
        const row = flattenNoteRow(await noteApiJson<NoteRow>("GET", noteResourceUrl(slug)));
        if (!hasPrivateEnvelope(row)) {
          return { exists: false as const };
        }
        return readRow(row);
      } catch (error) {
        if (isMissingPlaceError(error)) {
          return { exists: false as const };
        }
        throw error;
      }
    },

    async publishEncryptedAttachment(command: PublishAttachmentCommand) {
      return noteApiJson<{ id: string; created_at: string }>(
        "POST",
        noteResourceUrl(command.slug, "attachments"),
        {
          storage_path: command.storagePath,
          iv: command.iv,
          filename_ciphertext: command.filenameCiphertext,
          filename_iv: command.filenameIv,
          mime: command.mime,
          size: command.size,
        },
      );
    },

    async deleteEncryptedAttachment(command: DeleteAttachmentCommand) {
      await noteApiJson("DELETE", noteResourceUrl(command.slug, "attachments", command.attachmentId));
    },

    async updateExpiry(command: UpdateExpiryCommand) {
      const row = await noteApiJson<{ burn_mode: string; expires_at: string | null }>(
        "PATCH",
        noteResourceUrl(command.slug),
        { burn_mode: command.burnMode },
      );
      return { burn_mode: row.burn_mode, expires_at: row.expires_at };
    },
  };
}
