// Browser-only zero-knowledge crypto for Kodama.
//
// Argon2id (via hash-wasm) derives a 256-bit key from the user's password.
// AES-256-GCM (via WebCrypto) encrypts the page contents and attachments.
// The server only ever sees ciphertext + salt + IV + KDF params.

import { argon2id } from "hash-wasm";

export type KdfParams = {
  algo: "argon2id";
  // Memory cost in KiB. 65536 = 64 MiB.
  m: number;
  // Iterations.
  t: number;
  // Parallelism.
  p: number;
  // Argon2 version.
  version: number;
};

export const DEFAULT_KDF_PARAMS: KdfParams = {
  algo: "argon2id",
  m: 65536,
  t: 3,
  p: 1,
  version: 0x13,
};

/** Coerce KDF params loaded from JSON/Postgres — missing or string fields break Argon2. */
export function normalizeKdfParams(raw: unknown): KdfParams {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    algo: "argon2id",
    m: Number(p.m) || DEFAULT_KDF_PARAMS.m,
    t: Number(p.t) || DEFAULT_KDF_PARAMS.t,
    p: Number(p.p) || DEFAULT_KDF_PARAMS.p,
    version: Number(p.version) || DEFAULT_KDF_PARAMS.version,
  };
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Web Crypto (AES-GCM) is only available in secure contexts: HTTPS or localhost. */
function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    const host = typeof window !== "undefined" ? window.location.host : "";
    throw new Error(
      "Web Crypto is unavailable in this browser tab. Browsers only allow encryption on HTTPS " +
        "(or http://localhost / http://127.0.0.1). " +
        (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")
          ? `You opened http://${host} — restart with "yarn dev" and use the https://… URL instead.`
          : "Use https://localhost:8080 for local development."),
    );
  }
  return subtle;
}

export function isWebCryptoAvailable(): boolean {
  return globalThis.crypto?.subtle != null;
}

/** Map unlock failures to a user-facing message (decrypt errors ≠ always wrong password). */
export function unlockErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("Web Crypto is unavailable")) return err.message;
    if (err.message.includes("Unsupported KDF")) return err.message;
  }
  if (err instanceof DOMException && err.name === "OperationError") {
    return "Wrong password";
  }
  return (err as Error)?.message || "Could not unlock this page";
}

export function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveRawKeyBytes(
  password: string,
  saltB64: string,
  params: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<Uint8Array> {
  const kdf = normalizeKdfParams(params);
  const salt = fromB64(saltB64);
  const raw = await argon2id({
    password,
    salt,
    parallelism: kdf.p,
    iterations: kdf.t,
    memorySize: kdf.m,
    hashLength: 32,
    outputType: "binary",
  });
  return new Uint8Array(raw as ArrayLike<number>);
}

export async function importAesKeyFromRaw(rawKey: Uint8Array): Promise<CryptoKey> {
  return getSubtleCrypto().importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function deriveKey(
  password: string,
  saltB64: string,
  params: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<CryptoKey> {
  const rawKey = await deriveRawKeyBytes(password, saltB64, params);
  return importAesKeyFromRaw(rawKey);
}

export async function encrypt(
  key: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = randomBytes(12);
  const ct = await getSubtleCrypto().encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    enc.encode(plaintext) as unknown as BufferSource,
  );
  return { ciphertext: toB64(new Uint8Array(ct)), iv: toB64(iv) };
}

export async function decrypt(
  key: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
): Promise<string> {
  const pt = await getSubtleCrypto().decrypt(
    { name: "AES-GCM", iv: fromB64(ivB64) as unknown as BufferSource },
    key,
    fromB64(ciphertextB64) as unknown as BufferSource,
  );
  return dec.decode(pt);
}

export async function encryptBytes(
  key: CryptoKey,
  bytes: Uint8Array,
): Promise<{ ciphertext: Uint8Array; iv: string }> {
  const iv = randomBytes(12);
  const ct = await getSubtleCrypto().encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    bytes as unknown as BufferSource,
  );
  return { ciphertext: new Uint8Array(ct), iv: toB64(iv) };
}

export async function decryptBytes(
  key: CryptoKey,
  ciphertext: Uint8Array,
  ivB64: string,
): Promise<Uint8Array> {
  const pt = await getSubtleCrypto().decrypt(
    { name: "AES-GCM", iv: fromB64(ivB64) as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource,
  );
  return new Uint8Array(pt);
}

export function newSalt(): string {
  return toB64(randomBytes(16));
}

export function randomPath(): string {
  // 32-char URL-safe random ID for storage paths.
  return toB64(randomBytes(24)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
