import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createNoteApiDeliveryClient,
  createPlaceRequestBody,
  savePrivateRequestBody,
} from "@/lib/note-delivery-client";
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
    header: { signatureB64: "knp-state-sig" },
  } as PublishProtectedNoteCommand["meta"]["state"],
  protected_master_key: {},
  owner_wrapped_cek: {},
  owner_wrapped_sign_seed: {},
  storage_mode: "knp-envelope",
} as PublishProtectedNoteCommand["meta"];

describe("delivery-gate request bodies", () => {
  it("create POST only sends the gate allowlist and the Gate signature", () => {
    const body = createPlaceRequestBody({
      kind: "note.publishProtected",
      slug: "itcvmaster",
      placeId: "itcvmaster",
      objectId: "workbook",
      burnMode: "never",
      saltB64: "salt",
      meta,
      noteEnvelope: new Uint8Array([1, 2, 3]),
      gateSignatureB64: "gate-sig",
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
    expect(body.state_signature).toBe("gate-sig");
    expect(body.state_signature).not.toBe("knp-state-sig");
  });

  it("private PUT sends salt and the Gate signature, not expected_version", () => {
    const body = savePrivateRequestBody({
      kind: "note.appendProtected",
      slug: "itcvmaster",
      placeId: "itcvmaster",
      expectedVersion: 3,
      meta,
      noteEnvelope: new Uint8Array([1]),
      saltB64: "salt",
      writerPublicKeyB64: "writer",
      stateSignatureB64: "knp-state-sig",
      gateSignatureB64: "gate-sig",
    } satisfies AppendProtectedNoteCommand);
    expect(body).not.toHaveProperty("expected_version");
    expect(body).not.toHaveProperty("version");
    expect(body.state_signature).toBe("gate-sig");
    expect(body.salt).toBe("salt");
  });
});

describe("fetchProtectedNote", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("skips a public-only /private row and reads the envelope from GET /{slug}", async () => {
    vi.stubEnv("VITE_NOTE_API_URL", "https://gate.test/v1/notes");
    vi.stubEnv("VITE_BACKEND_URL", "");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/garden/private")) {
        return new Response(JSON.stringify({ slug: "garden", tabs: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          slug: "garden",
          ciphertext: "YQ==",
          salt: "cw==",
          kdf_params: meta,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const fetched = await createNoteApiDeliveryClient().fetchProtectedNote("garden");
    expect(fetched.exists).toBe(true);
    if (!fetched.exists) return;
    expect(fetched.meta.protocol).toBe("knp-1");
    expect(fetched.saltB64).toBe("cw==");
  });
});
