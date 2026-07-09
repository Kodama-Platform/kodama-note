import { describe, expect, it } from "vitest";

import {
  decrypt,
  deriveKey,
  encrypt,
  fromB64,
  newSalt,
  normalizeKdfParams,
  toB64,
  type KdfParams,
} from "@/lib/crypto";

// Fast KDF for unit tests — production uses DEFAULT_KDF_PARAMS (64 MiB).
const TEST_KDF: KdfParams = {
  algo: "argon2id",
  m: 1024,
  t: 1,
  p: 1,
  version: 0x13,
};

describe("normalizeKdfParams", () => {
  it("fills defaults when Postgres JSON omits algo or uses string numbers", () => {
    expect(normalizeKdfParams({ m: "65536", t: "3", p: "1", version: "19" })).toEqual({
      algo: "argon2id",
      m: 65536,
      t: 3,
      p: 1,
      version: 19,
    });
  });
});

describe("client-side encryption", () => {
  it("derives a key from the password only in the browser (never sent to the server)", async () => {
    const salt = newSalt();
    const key = await deriveKey("my-secret-password", salt, TEST_KDF);
    expect(key.type).toBe("secret");
    expect(key.algorithm.name).toBe("AES-GCM");
  });

  it("encrypts plaintext to ciphertext that differs from the original", async () => {
    const password = "page-password-123";
    const salt = newSalt();
    const key = await deriveKey(password, salt, TEST_KDF);
    const plaintext = "Private journal entry — only I should read this.";

    const { ciphertext, iv } = await encrypt(key, plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(iv.length).toBeGreaterThan(0);
    // Ciphertext should be opaque base64, not readable text.
    expect(ciphertext).not.toMatch(/journal/i);
  });

  it("round-trips encrypt → decrypt with the same password-derived key", async () => {
    const password = "correct-horse-battery";
    const salt = newSalt();
    const key = await deriveKey(password, salt, TEST_KDF);
    const original = "Meeting notes:\n- encrypt before save\n- never store password";

    const { ciphertext, iv } = await encrypt(key, original);
    const restored = await decrypt(key, ciphertext, iv);

    expect(restored).toBe(original);
  });

  it("fails decryption with a wrong password", async () => {
    const salt = newSalt();
    const key = await deriveKey("right-password", salt, TEST_KDF);
    const { ciphertext, iv } = await encrypt(key, "secret");

    const wrongKey = await deriveKey("wrong-password", salt, TEST_KDF);
    await expect(decrypt(wrongKey, ciphertext, iv)).rejects.toThrow();
  });

  it("produces payloads suitable for the database (ciphertext + salt + iv only)", async () => {
    const password = "db-safe-test";
    const salt = newSalt();
    const key = await deriveKey(password, salt, TEST_KDF);
    const { ciphertext, iv } = await encrypt(key, "stored encrypted");

    const dbPayload = {
      p_ciphertext: ciphertext,
      p_salt: salt,
      p_iv: iv,
      p_kdf_params: TEST_KDF,
    };

    expect(dbPayload).not.toHaveProperty("password");
    expect(dbPayload).not.toHaveProperty("plaintext");
    expect(JSON.stringify(dbPayload)).not.toContain(password);
    expect(fromB64(ciphertext).length).toBeGreaterThan(0);
    expect(toB64(fromB64(salt))).toBe(salt);
  });
});
