import { describe, expect, it } from "vitest";

import { createPlaceRequestBody, savePrivateRequestBody } from "@/lib/note-delivery-client";
import type { AppendProtectedNoteCommand, PublishProtectedNoteCommand } from "@/lib/note-protocol";

const meta = {
  protocol: "knp-1",
  suite: "KSC_V1",
  product_type: "note",
  owner_public_key: "pub",
  owner_id: "owner",
  epoch: 0,
  version: 0,
  policy: {} as PublishProtectedNoteCommand["meta"]["policy"],
  state: {
    header: { signatureB64: "sig" },
  } as PublishProtectedNoteCommand["meta"]["state"],
  protected_master_key: {},
  owner_wrapped_cek: {},
  owner_wrapped_sign_seed: {},
  storage_mode: "knp-envelope",
} as PublishProtectedNoteCommand["meta"];

describe("delivery-gate request bodies", () => {
  it("create POST only sends the gate allowlist", () => {
    const body = createPlaceRequestBody({
      kind: "note.publishProtected",
      slug: "itcvmaster",
      placeId: "itcvmaster",
      objectId: "workbook",
      burnMode: "never",
      saltB64: "salt",
      meta,
      noteEnvelope: new Uint8Array([1, 2, 3]),
    });
    expect(Object.keys(body).sort()).toEqual(
      [
        "burn_mode",
        "ciphertext",
        "kdf_params",
        "owner_public_key",
        "salt",
        "slug",
        "state_signature",
      ].sort(),
    );
    expect(body).not.toHaveProperty("version");
  });

  it("private PUT does not send expected_version", () => {
    const body = savePrivateRequestBody({
      kind: "note.appendProtected",
      slug: "itcvmaster",
      placeId: "itcvmaster",
      expectedVersion: 3,
      meta,
      noteEnvelope: new Uint8Array([1]),
      writerPublicKeyB64: "writer",
      stateSignatureB64: "sig",
    } satisfies AppendProtectedNoteCommand);
    expect(body).not.toHaveProperty("expected_version");
    expect(body).not.toHaveProperty("version");
  });
});
