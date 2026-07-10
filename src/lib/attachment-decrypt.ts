import { decrypt } from "@/lib/crypto";
import type { AttachmentRow } from "@/lib/pages";

export type DecryptedAttachment = AttachmentRow & { filename: string };

export async function decryptAttachmentFilenames(
  rows: AttachmentRow[],
  cryptoKey: CryptoKey,
): Promise<DecryptedAttachment[]> {
  return Promise.all(
    rows.map(async (r) => {
      try {
        const filename = await decrypt(cryptoKey, r.filename_ciphertext, r.filename_iv);
        return { ...r, filename };
      } catch {
        return { ...r, filename: "(unreadable)" };
      }
    }),
  );
}
