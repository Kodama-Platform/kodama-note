import { bytesToBase64 } from "@kodama.page/core";

import { wireJson } from "@/lib/gate-sign";
import type { KnpPlaceMeta } from "@/lib/note-protocol";

/** POST /v1/notes document — Gate allowlist only (no version / history). */
export function createPlaceDocument(input: {
  slug: string;
  saltB64: string;
  burnMode: string;
  meta: KnpPlaceMeta;
  noteEnvelope: Uint8Array;
}): Record<string, unknown> {
  return wireJson({
    slug: input.slug,
    ciphertext: bytesToBase64(input.noteEnvelope),
    salt: input.saltB64,
    kdf_params: input.meta as unknown as Record<string, unknown>,
    burn_mode: input.burnMode,
  });
}

/** PUT /v1/notes/{slug}/private document. */
export function savePrivateDocument(input: {
  saltB64: string;
  meta: KnpPlaceMeta;
  noteEnvelope: Uint8Array;
}): Record<string, unknown> {
  return wireJson({
    ciphertext: bytesToBase64(input.noteEnvelope),
    salt: input.saltB64,
    kdf_params: input.meta as unknown as Record<string, unknown>,
  });
}
