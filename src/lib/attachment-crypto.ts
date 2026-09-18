/**
 * Attachment crypto via KSC `security.files` (never compressed).
 * File keys are wrapped under the note CEK; chunk ciphertext is stored as a package.
 */

import {
  base64ToBytes,
  bytesToBase64,
  clearBytes,
  utf8Encode,
  type AttachmentTransportManifest,
  type EncryptedChunk,
  type KeyHandle,
} from "@kodama.page/core";

import type { PlaceCryptoSession } from "@/lib/crypto-context";
import { OBJECT_ID_WORKBOOK, KNP_PRODUCT_ID } from "@/lib/note-protocol/constants";
import {
  reviveWrappedKey,
  serializeWrappedKey,
} from "@/lib/note-protocol";
import { composeKodamaNoteApp } from "@/lib/security-bootstrap";
import { deriveReaderWrapKeyBytes } from "@/lib/note-protocol/wrap-aad";
import type { AttachmentRow } from "@/lib/pages";
import { stripPlaceVersion } from "@/lib/attachment-meta";
import { toBufferSource } from "@/lib/crypto-utils";

type StoredChunk = {
  index: number;
  nonceB64: string;
  ciphertextB64: string;
  plaintextSize: number;
  ciphertextSha256B64: string;
};

type AttachmentPackageV2 = {
  v: 2;
  protocol: "knp-1";
  attachmentId: string;
  filename?: string;
  mime: string;
  wrappedFileKey: unknown;
  transportManifest: unknown;
  chunks: StoredChunk[];
};

function serializeTransportManifest(m: AttachmentTransportManifest): unknown {
  return {
    version: m.version,
    suite: m.suite,
    compression: m.compression,
    chunkSize: m.chunkSize,
    chunkCount: m.chunkCount,
    encryptedSize: m.encryptedSize,
    chunks: m.chunks.map((c) => ({
      index: c.index,
      ciphertextLength: c.ciphertextLength,
      ciphertextSha256B64: bytesToBase64(c.ciphertextSha256),
    })),
    encryptedMetadata: {
      suite: m.encryptedMetadata.suite,
      nonceB64: bytesToBase64(m.encryptedMetadata.nonce),
      ciphertextB64: bytesToBase64(m.encryptedMetadata.ciphertext),
    },
  };
}

function reviveTransportManifest(raw: unknown): AttachmentTransportManifest {
  const m = raw as {
    version: 1;
    suite: "KSC_V1";
    compression: "none";
    chunkSize: number;
    chunkCount: number;
    encryptedSize: number;
    chunks: Array<{
      index: number;
      ciphertextLength: number;
      ciphertextSha256B64: string;
    }>;
    encryptedMetadata: {
      suite: "KSC_V1";
      nonceB64: string;
      ciphertextB64: string;
    };
  };
  return {
    version: m.version,
    suite: m.suite,
    compression: "none",
    chunkSize: m.chunkSize,
    chunkCount: m.chunkCount,
    encryptedSize: m.encryptedSize,
    chunks: m.chunks.map((c) => ({
      index: c.index,
      ciphertextLength: c.ciphertextLength,
      ciphertextSha256: base64ToBytes(c.ciphertextSha256B64),
    })),
    encryptedMetadata: {
      suite: m.encryptedMetadata.suite,
      nonce: base64ToBytes(m.encryptedMetadata.nonceB64) as AttachmentTransportManifest["encryptedMetadata"]["nonce"],
      ciphertext: base64ToBytes(
        m.encryptedMetadata.ciphertextB64,
      ) as AttachmentTransportManifest["encryptedMetadata"]["ciphertext"],
    },
  };
}

function serializeChunks(chunks: EncryptedChunk[]): StoredChunk[] {
  return chunks.map((c) => ({
    index: c.index,
    nonceB64: bytesToBase64(c.nonce),
    ciphertextB64: bytesToBase64(c.ciphertext),
    plaintextSize: c.plaintextSize,
    ciphertextSha256B64: bytesToBase64(c.ciphertextSha256),
  }));
}

function reviveChunks(chunks: StoredChunk[]): EncryptedChunk[] {
  return chunks.map((c) => ({
    index: c.index,
    nonce: base64ToBytes(c.nonceB64) as EncryptedChunk["nonce"],
    ciphertext: base64ToBytes(c.ciphertextB64) as EncryptedChunk["ciphertext"],
    plaintextSize: c.plaintextSize,
    ciphertextSha256: base64ToBytes(c.ciphertextSha256B64),
  }));
}

async function* chunkIterable(chunks: EncryptedChunk[]): AsyncGenerator<EncryptedChunk> {
  for (const c of chunks) yield c;
}

async function wrapFileKeyUnderCek(
  contentKey: KeyHandle,
  fileKey: KeyHandle,
  placeId: string,
  attachmentId: string,
) {
  const { security } = composeKodamaNoteApp();
  const aad = new TextEncoder().encode(`knp-1|file-key|${placeId}|${attachmentId}`);
  return security.keys.wrapSymmetricKey({
    wrappingKey: contentKey,
    keyToWrap: fileKey,
    aad,
  });
}

async function encryptFilenameUnderCek(
  contentKey: KeyHandle,
  filename: string,
  attachmentId: string,
): Promise<{ ciphertext: string; iv: string }> {
  const { security } = composeKodamaNoteApp();
  const cekBytes = await security.keys.exportSymmetricKey(contentKey);
  let keyBytes: Uint8Array;
  try {
    keyBytes = await deriveReaderWrapKeyBytes(cekBytes, "filename", attachmentId);
  } finally {
    clearBytes(cekBytes);
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBufferSource(keyBytes),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  clearBytes(keyBytes);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    utf8Encode(filename),
  );
  return { ciphertext: bytesToBase64(new Uint8Array(ct)), iv: bytesToBase64(iv) };
}

async function decryptFilenameUnderCek(
  contentKey: KeyHandle,
  filenameCiphertext: string,
  filenameIv: string,
  attachmentId: string,
): Promise<string> {
  const { security } = composeKodamaNoteApp();
  const cekBytes = await security.keys.exportSymmetricKey(contentKey);
  let keyBytes: Uint8Array;
  try {
    keyBytes = await deriveReaderWrapKeyBytes(cekBytes, "filename", attachmentId);
  } finally {
    clearBytes(cekBytes);
  }
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBufferSource(keyBytes),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  clearBytes(keyBytes);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBufferSource(base64ToBytes(filenameIv)) },
    cryptoKey,
    toBufferSource(base64ToBytes(filenameCiphertext)),
  );
  return new TextDecoder().decode(pt);
}

async function unwrapFileKey(
  contentKey: KeyHandle,
  wrapped: unknown,
  placeId: string,
  attachmentId: string,
): Promise<KeyHandle> {
  const { security } = composeKodamaNoteApp();
  const aad = new TextEncoder().encode(`knp-1|file-key|${placeId}|${attachmentId}`);
  return security.keys.unwrapSymmetricKey({
    wrappingKey: contentKey,
    wrappedKey: reviveWrappedKey(wrapped),
    aad,
    purpose: "file",
  });
}

/** Encrypt attachment with KSC files API; package for Delivery Gate storage. */
export async function encryptAttachmentPayload(
  crypto: PlaceCryptoSession,
  args: { bytes: Uint8Array; filename: string; mime: string },
): Promise<{
  ciphertext: Uint8Array;
  iv: string;
  filename_ciphertext: string;
  filename_iv: string;
  mime: string;
  attachmentId: string;
  fileKeyB64: string;
  transportManifestB64: string;
}> {
  if (crypto.kind !== "knp") {
    throw new Error("Attachments require a KNP-1 session");
  }
  const { note } = composeKodamaNoteApp();
  const session = crypto.session;
  const attachmentId = globalThis.crypto.randomUUID();
  const { fileKey, manifest, chunks } = await note.encryptAttachment({
    session,
    attachmentId,
    bytes: args.bytes,
    filename: args.filename,
    mediaType: args.mime,
  });
  const wrappedFileKey = await wrapFileKeyUnderCek(
    session.contentKey,
    fileKey,
    session.placeId,
    attachmentId,
  );
  const pkg: AttachmentPackageV2 = {
    v: 2,
    protocol: "knp-1",
    attachmentId,
    mime: args.mime,
    wrappedFileKey: serializeWrappedKey(wrappedFileKey),
    transportManifest: serializeTransportManifest(manifest),
    chunks: serializeChunks(chunks),
  };
  const nameEnc = await encryptFilenameUnderCek(session.contentKey, args.filename, attachmentId);
  const fileKeyBytes = await composeKodamaNoteApp().security.keys.exportSymmetricKey(fileKey);
  const fileKeyB64 = bytesToBase64(fileKeyBytes);
  clearBytes(fileKeyBytes);
  return {
    ciphertext: new TextEncoder().encode(JSON.stringify(pkg)),
    iv: "",
    filename_ciphertext: nameEnc.ciphertext,
    filename_iv: nameEnc.iv,
    mime: `${args.mime}; knp=1; attachment-id=${attachmentId}`,
    attachmentId,
    fileKeyB64,
    transportManifestB64: bytesToBase64(
      new TextEncoder().encode(JSON.stringify(serializeTransportManifest(manifest))),
    ),
  };
}

export async function decryptAttachmentBytes(
  crypto: PlaceCryptoSession,
  _row: Pick<AttachmentRow, "iv" | "mime">,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  if (crypto.kind !== "knp") {
    throw new Error("Attachments require a KNP-1 session");
  }
  const { security } = composeKodamaNoteApp();
  const session = crypto.session;
  const pkg = JSON.parse(new TextDecoder().decode(ciphertext)) as AttachmentPackageV2;
  if (pkg.v !== 2 || pkg.protocol !== "knp-1") {
    throw new Error("unsupported attachment package");
  }
  const fileKey = await unwrapFileKey(
    session.contentKey,
    pkg.wrappedFileKey,
    session.placeId,
    pkg.attachmentId,
  );
  const manifest = reviveTransportManifest(pkg.transportManifest);
  const chunks = reviveChunks(pkg.chunks);
  const result = await security.files.decryptAttachment({
    fileKey,
    binding: {
      productId: KNP_PRODUCT_ID,
      placeId: session.placeId,
      objectId: OBJECT_ID_WORKBOOK,
      attachmentId: pkg.attachmentId,
      protocolVersion: 1,
    },
    manifest,
    chunks: chunkIterable(chunks),
  });
  const parts: Uint8Array[] = [];
  let total = 0;
  for await (const part of result.plaintext) {
    parts.push(part);
    total += part.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export async function decryptAttachmentFilename(
  crypto: PlaceCryptoSession,
  row: Pick<AttachmentRow, "filename_ciphertext" | "filename_iv" | "mime">,
  fallback = "attachment",
): Promise<string> {
  if (crypto.kind !== "knp") return fallback;
  if (row.filename_ciphertext && row.filename_iv) {
    try {
      const attachmentId =
        row.mime.match(/attachment-id=([^;]+)/i)?.[1]?.trim() ?? "attachment";
      return await decryptFilenameUnderCek(
        crypto.session.contentKey,
        row.filename_ciphertext,
        row.filename_iv,
        attachmentId,
      );
    } catch {
      try {
        return new TextDecoder().decode(base64ToBytes(row.filename_ciphertext));
      } catch {
        return fallback;
      }
    }
  }
  return fallback;
}

export function attachmentContentType(mime: string): string {
  return stripPlaceVersion(mime).replace(/;\s*knp=1.*/i, "").replace(/;\s*attachment-id=[^;]+/i, "").trim();
}
