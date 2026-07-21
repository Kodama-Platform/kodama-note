import { describe, expect, it } from "vitest";

import type { PlaceCryptoSession } from "@/lib/crypto-context";
import { LEGACY_EDITOR_SENTINEL } from "@/lib/ksp-fragment";
import { resolveShareCapabilities } from "@/lib/share-capabilities";

describe("resolveShareCapabilities", () => {
  it("derives reader capability from live KSP session readKey first", () => {
    const session: PlaceCryptoSession = {
      kind: "ksp",
      readKey: new Uint8Array([1, 2, 3]),
      secrets: {
        readerCapability: "",
        editorPrivateKey: "editor-key",
        ownerPrivateKey: "owner-key",
      },
      editorPublicKey: "pub",
      slug: "wallet",
      version: 1,
      productType: "note",
      storageMode: "bundle",
    };

    const resolved = resolveShareCapabilities({
      session,
      stored: null,
      readFromUrl: null,
    });

    expect(resolved.readerCapability).toBe("AQID");
    expect(resolved.editorPrivateKey).toBe("editor-key");
  });

  it("falls back to stored secrets when session secrets are empty", () => {
    const session: PlaceCryptoSession = {
      kind: "ksp",
      readKey: new Uint8Array(),
      secrets: {
        readerCapability: "",
        editorPrivateKey: "",
        ownerPrivateKey: "",
      },
      editorPublicKey: "pub",
      slug: "wallet",
      version: 1,
      productType: "note",
      storageMode: "bundle",
    };

    const resolved = resolveShareCapabilities({
      session,
      stored: {
        readerCapability: "stored-read",
        editorPrivateKey: "stored-editor",
        ownerPrivateKey: "",
      },
      readFromUrl: null,
    });

    expect(resolved).toEqual({
      readerCapability: "stored-read",
      editorPrivateKey: "stored-editor",
    });
  });

  it("uses stored legacy editor sentinel for legacy sessions", () => {
    const session: PlaceCryptoSession = {
      kind: "legacy",
      cryptoKey: {} as CryptoKey,
    };

    const resolved = resolveShareCapabilities({
      session,
      stored: {
        readerCapability: "legacy-read-key",
        editorPrivateKey: LEGACY_EDITOR_SENTINEL,
        ownerPrivateKey: "",
      },
      readFromUrl: null,
    });

    expect(resolved).toEqual({
      readerCapability: "legacy-read-key",
      editorPrivateKey: LEGACY_EDITOR_SENTINEL,
    });
  });
});
