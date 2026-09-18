import * as ed25519 from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { bytesToBase64 } from "@kodama.page/core";
import { createBrowserSecurityProvider } from "@kodama.page/security-browser";
import { describe, expect, it } from "vitest";

import {
  GATE_CREATE_PURPOSE,
  encodePlaceSignMessage,
} from "@/lib/gate-sign";
import { createPlaceDocument } from "@/lib/note-gate-body";
import { createPlaceRequestBody } from "@/lib/note-delivery-client";
import type { KnpPlaceMeta } from "@/lib/note-protocol";

ed25519.etc.sha512Sync = (...messages: Uint8Array[]) =>
  sha512(ed25519.etc.concatBytes(...messages));

const STRIP = new Set(["owner_public_key", "writer_public_key", "state_signature"]);

function stripSignatureFields(body: Record<string, unknown>): Record<string, unknown> {
  const document: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (STRIP.has(key)) continue;
    document[key] = value;
  }
  return document;
}

describe("Gate create signature", () => {
  it("verifies like the Delivery Gate: noble Ed25519 over rebuilt CBOR", async () => {
    const security = createBrowserSecurityProvider();
    const keys = await security.keys.generateSigningKey();
    const ownerPublicKey = bytesToBase64(keys.publicKey.bytes);
    const meta = {
      protocol: "knp-1",
      suite: "KSC_V1",
      product_type: "note",
      owner_public_key: ownerPublicKey,
      owner_id: "owner",
      epoch: 0,
      version: 0,
      policy: { previousPolicyHashB64: null, editorCertificates: [] },
      state: { header: { signatureB64: "knp-state-sig" } },
      protected_master_key: { salt: "c2FsdA==" },
      owner_wrapped_cek: {},
      owner_wrapped_sign_seed: {},
      storage_mode: "knp-envelope",
    } as unknown as KnpPlaceMeta;

    const document = createPlaceDocument({
      slug: "itcvmaster",
      saltB64: "c2FsdA==",
      burnMode: "never",
      meta,
      noteEnvelope: new Uint8Array([1, 2, 3]),
    });
    const message = encodePlaceSignMessage(GATE_CREATE_PURPOSE, "itcvmaster", document);
    const signature = await security.signatures.sign({
      privateKey: keys.privateKey,
      message,
    });
    const body = createPlaceRequestBody({
      kind: "note.publishProtected",
      slug: "itcvmaster",
      placeId: "itcvmaster",
      objectId: "workbook",
      burnMode: "never",
      saltB64: "c2FsdA==",
      meta,
      noteEnvelope: new Uint8Array([1, 2, 3]),
      gateSignatureB64: bytesToBase64(signature),
    });

    const rebuilt = encodePlaceSignMessage(
      GATE_CREATE_PURPOSE,
      "itcvmaster",
      stripSignatureFields(body),
    );
    expect(
      ed25519.verify(signature, rebuilt, keys.publicKey.bytes),
    ).toBe(true);
    expect(body.state_signature).not.toBe("knp-state-sig");
  });
});
