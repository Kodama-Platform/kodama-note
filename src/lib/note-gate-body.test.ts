import { describe, expect, it } from "vitest";

import { createPlaceDocument, savePrivateDocument } from "@/lib/note-gate-body";
import type { KnpPlaceMeta } from "@/lib/note-protocol";

const meta = {
  protocol: "knp-1",
  suite: "KSC_V1",
  product_type: "note",
  owner_public_key: "pub",
  owner_id: "owner",
  epoch: 0,
  version: 0,
  policy: {},
  state: { header: { signatureB64: "knp" } },
  protected_master_key: {},
  owner_wrapped_cek: {},
  owner_wrapped_sign_seed: {},
  storage_mode: "knp-envelope",
} as unknown as KnpPlaceMeta;

describe("note-gate-body", () => {
  it("create document is the Gate allowlist and keeps version only inside kdf_params", () => {
    const document = createPlaceDocument({
      slug: "itcvmaster",
      saltB64: "salt",
      burnMode: "never",
      meta,
      noteEnvelope: new Uint8Array([1, 2, 3]),
    });
    expect(Object.keys(document).sort()).toEqual(
      ["burn_mode", "ciphertext", "kdf_params", "salt", "slug"].sort(),
    );
    expect(document).not.toHaveProperty("version");
    expect((document.kdf_params as { version: number }).version).toBe(0);
  });

  it("private document includes salt and omits history fields", () => {
    const document = savePrivateDocument({
      saltB64: "salt",
      meta,
      noteEnvelope: new Uint8Array([1]),
    });
    expect(document.salt).toBe("salt");
    expect(document).not.toHaveProperty("version");
    expect(document).not.toHaveProperty("expected_version");
  });
});
