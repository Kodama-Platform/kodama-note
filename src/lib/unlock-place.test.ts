import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deriveRawKeyBytes,
  encrypt,
  newSalt,
  toB64,
  type KdfParams,
} from "@/lib/crypto";
import { LEGACY_EDITOR_SENTINEL } from "@/lib/ksp-fragment";
import type { ExistingPage } from "@/lib/pages";
import { readKspSecrets } from "@/lib/ksp-secrets";
import { unlockPlace } from "@/lib/unlock-place";

const TEST_KDF: KdfParams = {
  algo: "argon2id",
  m: 1024,
  t: 1,
  p: 1,
  version: 0x13,
};

function mockHash(hash: string) {
  vi.stubGlobal("window", {
    location: { hash, pathname: "/philosophy", search: "", host: "localhost:8080" },
    sessionStorage: {
      store: new Map<string, string>(),
      getItem(key: string) {
        return this.store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, value);
      },
      removeItem(key: string) {
        this.store.delete(key);
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  });
}

describe("unlockPlace read fragment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens with #read= even when a wrong password is supplied", async () => {
    const password = "correct-password";
    const salt = newSalt();
    const rawKey = await deriveRawKeyBytes(password, salt, TEST_KDF);
    const key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    const plaintext = "Shared philosophy notes";
    const { ciphertext, iv } = await encrypt(key, plaintext);

    const readCapability = toB64(rawKey);
    mockHash(`#read=${encodeURIComponent(readCapability)}`);

    const page: ExistingPage = {
      slug: "philosophy",
      ciphertext,
      salt,
      iv,
      kdf_params: TEST_KDF,
      updated_at: new Date().toISOString(),
      burn_mode: "never",
      expires_at: null,
    };

    const unlocked = await unlockPlace({ page, password: "totally-wrong" });

    expect(unlocked.plaintext).toBe(plaintext);
    expect(unlocked.capability).toBe("reader");
    expect(unlocked.crypto.kind).toBe("legacy");
  });

  it("password unlock wins over #read= for full editor access on legacy places", async () => {
    const password = "correct-password";
    const salt = newSalt();
    const rawKey = await deriveRawKeyBytes(password, salt, TEST_KDF);
    const key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    const plaintext = "Owner notes";
    const { ciphertext, iv } = await encrypt(key, plaintext);
    const readCapability = toB64(rawKey);
    mockHash(`#read=${encodeURIComponent(readCapability)}`);

    const page: ExistingPage = {
      slug: "philosophy",
      ciphertext,
      salt,
      iv,
      kdf_params: TEST_KDF,
      updated_at: new Date().toISOString(),
      burn_mode: "never",
      expires_at: null,
    };

    const unlocked = await unlockPlace({ page, password });

    expect(unlocked.plaintext).toBe(plaintext);
    expect(unlocked.capability).toBe("editor");
    expect(readKspSecrets("philosophy")?.editorPrivateKey).toBe(LEGACY_EDITOR_SENTINEL);
  });

  it("auto-unlocks legacy places from #read= without a password", async () => {
    const password = "correct-password";
    const salt = newSalt();
    const rawKey = await deriveRawKeyBytes(password, salt, TEST_KDF);
    const key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    const plaintext = "Read-only via link";
    const { ciphertext, iv } = await encrypt(key, plaintext);
    const readCapability = toB64(rawKey);
    mockHash(`#read=${encodeURIComponent(readCapability)}`);

    const page: ExistingPage = {
      slug: "philosophy",
      ciphertext,
      salt,
      iv,
      kdf_params: TEST_KDF,
      updated_at: new Date().toISOString(),
      burn_mode: "never",
      expires_at: null,
    };

    const unlocked = await unlockPlace({ page, viaShareLink: true });

    expect(unlocked.plaintext).toBe(plaintext);
    expect(unlocked.capability).toBe("reader");
  });

  it("rejects a wrong password when no read fragment is present", async () => {
    const password = "correct-password";
    const salt = newSalt();
    const rawKey = await deriveRawKeyBytes(password, salt, TEST_KDF);
    const key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    const { ciphertext, iv } = await encrypt(key, "Secret");
    mockHash("");

    const page: ExistingPage = {
      slug: "philosophy",
      ciphertext,
      salt,
      iv,
      kdf_params: TEST_KDF,
      updated_at: new Date().toISOString(),
      burn_mode: "never",
      expires_at: null,
    };

    await expect(unlockPlace({ page, password: "wrong" })).rejects.toMatchObject({
      name: "OperationError",
    });
  });
});
