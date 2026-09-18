import { encodeCbor } from "@kodama.page/core";

/** Delivery Gate write purposes (docs/source-of-truth.md). */
export const GATE_CREATE_PURPOSE = "knp-place-create-1" as const;
export const GATE_PRIVATE_PUT_PURPOSE = "knp-private-tabs-put-1" as const;

/** Match JSON.parse(JSON.stringify) so we sign the same shape the Gate receives. */
export function wireJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Ed25519 message the Gate rebuilds: CBOR { document, purpose, slug }
 * with lexicographic map keys.
 */
export function encodePlaceSignMessage(
  purpose: string,
  slug: string,
  document: Record<string, unknown>,
): Uint8Array {
  return encodeCbor({
    document: wireJson(document),
    purpose,
    slug,
  });
}
