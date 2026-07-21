import {
  decryptPlaceBytes,
  decryptPlaceText,
  encryptPlaceBytes,
  encryptPlaceText,
  type PlaceCryptoSession,
} from "@/lib/crypto-context";
import { decryptKspBytes, decryptKspText } from "@/lib/ksp-place";
import { placeVersionFromMime, stripPlaceVersion, mimeWithPlaceVersion } from "@/lib/attachment-meta";
import type { AttachmentRow } from "@/lib/pages";

export async function encryptAttachmentPayload(
  crypto: PlaceCryptoSession,
  args: { bytes: Uint8Array; filename: string; mime: string },
): Promise<{
  ciphertext: Uint8Array;
  iv: string;
  filename_ciphertext: string;
  filename_iv: string;
  mime: string;
}> {
  const version = crypto.kind === "ksp" ? crypto.version : null;
  const { ciphertext, iv } = await encryptPlaceBytes(crypto, args.bytes);
  const { ciphertext: fnCt, iv: fnIv } = await encryptPlaceText(crypto, args.filename);
  return {
    ciphertext,
    iv,
    filename_ciphertext: fnCt,
    filename_iv: fnIv,
    mime: version != null ? mimeWithPlaceVersion(args.mime, version) : args.mime,
  };
}

async function decryptKspBytesAtVersion(
  session: Extract<PlaceCryptoSession, { kind: "ksp" }>,
  ciphertext: Uint8Array,
  iv: string,
  version: number,
): Promise<Uint8Array> {
  return decryptKspBytes({
    slug: session.slug,
    ciphertext,
    iv,
    readKey: session.readKey,
    version,
    productType: session.productType,
  });
}

async function decryptKspTextAtVersion(
  session: Extract<PlaceCryptoSession, { kind: "ksp" }>,
  ciphertext: string,
  iv: string,
  version: number,
): Promise<string> {
  return decryptKspText({
    slug: session.slug,
    ciphertextB64: ciphertext,
    iv,
    readKey: session.readKey,
    version,
    productType: session.productType,
  });
}

/** Decrypt attachment bytes using pinned place version (falls back for legacy uploads). */
export async function decryptAttachmentBytes(
  crypto: PlaceCryptoSession,
  row: Pick<AttachmentRow, "iv" | "mime">,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  if (crypto.kind === "legacy") {
    return decryptPlaceBytes(crypto, ciphertext, row.iv);
  }

  const pinned = placeVersionFromMime(row.mime);
  if (pinned != null) {
    return decryptKspBytesAtVersion(crypto, ciphertext, row.iv, pinned);
  }

  for (let version = crypto.version; version >= 1; version--) {
    try {
      return await decryptKspBytesAtVersion(crypto, ciphertext, row.iv, version);
    } catch {
      /* try older place versions */
    }
  }
  throw new Error("Could not decrypt attachment");
}

export async function decryptAttachmentFilename(
  crypto: PlaceCryptoSession,
  row: Pick<AttachmentRow, "filename_ciphertext" | "filename_iv" | "mime">,
): Promise<string> {
  if (crypto.kind === "legacy") {
    return decryptPlaceText(crypto, row.filename_ciphertext, row.filename_iv);
  }

  const pinned = placeVersionFromMime(row.mime);
  if (pinned != null) {
    return decryptKspTextAtVersion(crypto, row.filename_ciphertext, row.filename_iv, pinned);
  }

  for (let version = crypto.version; version >= 1; version--) {
    try {
      return await decryptKspTextAtVersion(
        crypto,
        row.filename_ciphertext,
        row.filename_iv,
        version,
      );
    } catch {
      /* try older place versions */
    }
  }
  return "(unreadable)";
}

export function attachmentContentType(mime: string): string {
  return stripPlaceVersion(mime) || "application/octet-stream";
}
