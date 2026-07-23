import { verifyCreatePlaceBundlePayload } from "@kodama.page/ksp-core";
import {
  isKspPlaceMeta,
  parseKspWire,
  wireItemsToBundle,
  type KspPlaceMeta,
} from "./ksp-wire.ts";

export type VerifyCreateWireResult =
  | { ok: true; meta: KspPlaceMeta }
  | { ok: false; status: number; error: string };

/** Shared create-signature checks for ksp-create-page and ksp-migrate-page. */
export async function verifyKspCreateWirePayload(args: {
  slug: string;
  ciphertext: string;
  salt: string;
  kdf_params: unknown;
}): Promise<VerifyCreateWireResult> {
  if (!isKspPlaceMeta(args.kdf_params)) {
    return { ok: false, status: 400, error: "kdf_params must be ksp-v1 metadata" };
  }

  const meta = args.kdf_params as KspPlaceMeta;
  if (!Array.isArray(meta.editor_public_keys) || meta.editor_public_keys.length < 1) {
    return { ok: false, status: 400, error: "editor_public_keys required" };
  }

  const wire = parseKspWire(args.ciphertext);
  if (!wire || wire.storage_mode !== "bundle" || !wire.bundle) {
    return { ok: false, status: 400, error: "invalid ksp wire payload" };
  }

  if (wire.version !== 1 || wire.edit) {
    return { ok: false, status: 400, error: "payload must be version 1 without edit block" };
  }

  const ok = await verifyCreatePlaceBundlePayload(
    {
      slug: args.slug,
      product_type: meta.product_type,
      version: 1,
      kdf: meta.kdf,
      salt: args.salt,
      owner_public_key: meta.owner_public_key,
      editor_public_keys: meta.editor_public_keys,
      owner_signature: meta.owner_signature,
      storage_mode: "bundle",
      notes: wire.bundle.notes.map((n) => ({ id: n.id, iv: n.iv })),
      attachments: wire.bundle.attachments.map((a) => ({ id: a.id, iv: a.iv })),
    },
    wireItemsToBundle(wire.bundle),
  );

  if (!ok) {
    return { ok: false, status: 403, error: "invalid create signature" };
  }

  return { ok: true, meta };
}
