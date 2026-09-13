import { describe, expect, it } from "vitest";
import { base64ToBytes } from "@kodama.page/core";

import {
  decodeEditorCapability,
  decodeReaderCapability,
  encodeCapabilityFragment,
  parseEditorCapabilityImport,
} from "@/lib/knp-fragment";
import type { EditorCapability, ReaderCapability } from "@/lib/note-protocol";

const wrapped = {
  suite: "KSC_V1" as const,
  nonce: new Uint8Array(12),
  ciphertext: new Uint8Array(32),
} as unknown as ReaderCapability["wrappedCek"];

const reader: ReaderCapability = {
  v: 1,
  protocol: "knp-1",
  placeId: "place",
  noteId: "workbook",
  capabilityId: "cap-1",
  epoch: 0,
  ownerId: "owner",
  readerSecretB64: "AQID",
  wrappedCek: wrapped,
};

describe("knp-fragment", () => {
  it("round-trips reader capability with wrapped CEK bytes", () => {
    const encoded = encodeCapabilityFragment(reader);
    const decoded = decodeReaderCapability(encoded);
    expect(decoded?.capabilityId).toBe("cap-1");
    expect(decoded?.wrappedCek.ciphertext).toEqual(wrapped.ciphertext);
  });

  it("decodes editor capability when private key present", () => {
    const editor: EditorCapability = {
      ...reader,
      editorPrivateKeyB64: "seed",
      editorPublicKeyB64: "pub",
      editorCapabilityId: "ed-1",
    };
    const decoded = decodeEditorCapability(encodeCapabilityFragment(editor));
    expect(decoded?.editorCapabilityId).toBe("ed-1");
    expect(decodeEditorCapability(encodeCapabilityFragment(reader))).toBeNull();
  });

  it("parses editor capability import JSON", () => {
    expect(
      parseEditorCapabilityImport(
        JSON.stringify({ protocol: "knp-1", slug: "x", editor: "cap" }),
      ),
    ).toEqual({ editor: "cap" });
    expect(parseEditorCapabilityImport("{}")).toBeNull();
    expect(base64ToBytes("AQID").length).toBe(3);
  });
});
