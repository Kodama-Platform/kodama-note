import { encryptAttachmentPayload } from "@/lib/attachment-crypto";
import type { PlaceCryptoSession } from "@/lib/crypto-context";
import { randomPath } from "@/lib/crypto-utils";
import { attachmentStorageUrl } from "@/lib/note-api";
import { registerAttachment, uploadAttachmentBlob } from "@/lib/pages";
import type { NoteSession } from "@/lib/note-protocol";
import { composeKodamaNoteApp } from "@/lib/security-bootstrap";

const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadEncryptedAttachment(args: {
  file: File;
  slug: string;
  crypto: PlaceCryptoSession;
}): Promise<{ id: string; url: string; mime: string; session?: NoteSession }> {
  const { file, slug, crypto } = args;
  if (file.size > MAX_BYTES) {
    throw new Error("Max 20 MB per file");
  }
  if (crypto.kind !== "knp") {
    throw new Error("Attachments require a KNP-1 session");
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const encrypted = await encryptAttachmentPayload(crypto, {
    bytes: buf,
    filename: file.name,
    mime: file.type || "application/octet-stream",
  });
  const path = `${slug}/${randomPath()}.bin`;

  const url = await uploadAttachmentBlob(
    path,
    new Blob([encrypted.ciphertext.buffer as ArrayBuffer]),
  );

  const { id } = await registerAttachment({
    slug,
    storage_path: path,
    iv: encrypted.iv,
    filename_ciphertext: encrypted.filename_ciphertext,
    filename_iv: encrypted.filename_iv,
    mime: encrypted.mime,
    size: file.size,
  });

  const { note } = composeKodamaNoteApp();
  const session = note.rememberAttachment(crypto.session, {
    attachmentId: encrypted.attachmentId,
    fileKeyB64: encrypted.fileKeyB64,
    transportManifestB64: encrypted.transportManifestB64,
    filename: file.name,
    mediaType: file.type || "application/octet-stream",
  });

  return {
    id,
    url: url || attachmentStorageUrl(slug, path),
    storagePath: path,
    mime: file.type || "application/octet-stream",
    session,
  };
}
