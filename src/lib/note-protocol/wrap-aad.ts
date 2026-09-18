import { encodeCbor, utf8Encode } from "@kodama.page/core";

import { toBufferSource } from "@/lib/crypto-utils";

import { KNP_PROTOCOL, KNP_SUITE } from "./constants";

export type WrapRole = "owner" | "reader" | "editor";

/** Authenticated wrap AAD per KNP-1 §3.3. */
export function encodeWrapAad(input: {
  readonly placeId: string;
  readonly noteId: string;
  readonly epoch: number;
  readonly capabilityId: string;
  readonly role: WrapRole;
  readonly ownerId: string;
}): Uint8Array {
  return encodeCbor({
    protocol: KNP_PROTOCOL,
    suite: KNP_SUITE,
    placeId: input.placeId,
    noteId: input.noteId,
    epoch: input.epoch,
    capabilityId: input.capabilityId,
    role: input.role,
    ownerId: input.ownerId,
  });
}

export function ownerCapabilityId(placeId: string): string {
  return `owner:${placeId}`;
}

/** Domain-separated label bytes for HKDF info (KNP-1 §3.1 / §3.3). */
export function wrapInfoLabel(kind: "owner-wrap" | "reader-wrap"): Uint8Array {
  return utf8Encode(`kodama.note.${kind}.v1`);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/** HKDF-SHA-256 (empty salt) used for owner/reader wrapping keys. */
export async function hkdfSha256(
  ikm: Uint8Array,
  info: Uint8Array,
  length = 32,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", toBufferSource(ikm), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: toBufferSource(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** K_OWNER_WRAP = HKDF(MASTER, "kodama.note.owner-wrap.v1" || PID || NID) */
export function ownerWrapInfo(placeId: string, noteId: string): Uint8Array {
  return concatBytes(wrapInfoLabel("owner-wrap"), utf8Encode(placeId), utf8Encode(noteId));
}

/** K_READER_WRAP = HKDF(READER_SECRET, "kodama.note.reader-wrap.v1" || NID || capability ID) */
export function readerWrapInfo(noteId: string, capabilityId: string): Uint8Array {
  return concatBytes(wrapInfoLabel("reader-wrap"), utf8Encode(noteId), utf8Encode(capabilityId));
}

export async function deriveOwnerWrapKeyBytes(
  masterBytes: Uint8Array,
  placeId: string,
  noteId: string,
): Promise<Uint8Array> {
  return hkdfSha256(masterBytes, ownerWrapInfo(placeId, noteId));
}

export async function deriveReaderWrapKeyBytes(
  readerSecret: Uint8Array,
  noteId: string,
  capabilityId: string,
): Promise<Uint8Array> {
  return hkdfSha256(readerSecret, readerWrapInfo(noteId, capabilityId));
}
