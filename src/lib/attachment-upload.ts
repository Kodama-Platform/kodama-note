import { encrypt, encryptBytes, randomPath } from "@/lib/crypto";
import { registerAttachment, uploadAttachmentBlob } from "@/lib/pages";
import { kodamaAttUrl } from "@/lib/kodama-image";

const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadEncryptedAttachment(args: {
  file: File;
  slug: string;
  editToken: string;
  cryptoKey: CryptoKey;
}): Promise<{ id: string; url: string; mime: string }> {
  const { file, slug, editToken, cryptoKey } = args;
  if (file.size > MAX_BYTES) {
    throw new Error("Max 20 MB per file");
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const { ciphertext, iv } = await encryptBytes(cryptoKey, buf);
  const { ciphertext: fnCt, iv: fnIv } = await encrypt(cryptoKey, file.name);
  const path = `${slug}/${randomPath()}.bin`;

  await uploadAttachmentBlob(path, new Blob([ciphertext.buffer as ArrayBuffer]));

  const { id } = await registerAttachment({
    slug,
    edit_token: editToken,
    storage_path: path,
    iv,
    filename_ciphertext: fnCt,
    filename_iv: fnIv,
    mime: file.type || "application/octet-stream",
    size: file.size,
  });

  return { id, url: kodamaAttUrl(id), mime: file.type || "application/octet-stream" };
}
