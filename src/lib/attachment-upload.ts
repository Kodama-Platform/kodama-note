import { encryptAttachmentPayload } from "@/lib/attachment-crypto";
import type { PlaceCryptoSession } from "@/lib/crypto-context";
import { randomPath } from "@/lib/crypto";
import { registerAttachment, uploadAttachmentBlob } from "@/lib/pages";
import { kodamaAttUrl } from "@/lib/kodama-image";
import { readLegacyEditToken } from "@/lib/legacy-edit";

const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadEncryptedAttachment(args: {
  file: File;
  slug: string;
  crypto: PlaceCryptoSession;
}): Promise<{ id: string; url: string; mime: string }> {
  const { file, slug, crypto } = args;
  if (file.size > MAX_BYTES) {
    throw new Error("Max 20 MB per file");
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const encrypted = await encryptAttachmentPayload(crypto, {
    bytes: buf,
    filename: file.name,
    mime: file.type || "application/octet-stream",
  });
  const path = `${slug}/${randomPath()}.bin`;

  await uploadAttachmentBlob(path, new Blob([encrypted.ciphertext.buffer as ArrayBuffer]));

  const { id } = await registerAttachment({
    slug,
    storage_path: path,
    iv: encrypted.iv,
    filename_ciphertext: encrypted.filename_ciphertext,
    filename_iv: encrypted.filename_iv,
    mime: encrypted.mime,
    ksp: crypto.kind === "ksp",
    legacyEditToken: readLegacyEditToken(slug),
  });

  return { id, url: kodamaAttUrl(id), mime: file.type || "application/octet-stream" };
}
