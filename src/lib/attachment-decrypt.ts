import type { PlaceCryptoSession } from "@/lib/crypto-context";
import { decryptAttachmentFilename } from "@/lib/attachment-crypto";
import type { AttachmentRow } from "@/lib/pages";

export type DecryptedAttachment = AttachmentRow & { filename: string };

export async function decryptAttachmentFilenames(
  rows: AttachmentRow[],
  crypto: PlaceCryptoSession,
): Promise<DecryptedAttachment[]> {
  return Promise.all(
    rows.map(async (r) => {
      try {
        const filename = await decryptAttachmentFilename(crypto, r);
        return { ...r, filename };
      } catch {
        return { ...r, filename: "(unreadable)" };
      }
    }),
  );
}
