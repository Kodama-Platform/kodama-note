// Browser-only zero-knowledge crypto for Kodama.
// Argon2id (hash-wasm) is isolated here so landing/note chunks do not pull WASM.

import { argon2id } from "hash-wasm";

import {
  fromB64,
  getSubtleCrypto,
  normalizeKdfParams,
  randomBytes,
  toB64,
  toBufferSource,
  type KdfParams,
  DEFAULT_KDF_PARAMS,
} from "@/lib/crypto-utils";

export {
  DEFAULT_KDF_PARAMS,
  fromB64,
  getSubtleCrypto,
  newSalt,
  normalizeKdfParams,
  randomBytes,
  randomPath,
  toB64,
  toBufferSource,
  unlockErrorMessage,
} from "@/lib/crypto-utils";
export type { KdfParams } from "@/lib/crypto-utils";

const enc = new TextEncoder();
const dec = new TextDecoder();

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
    toBufferSource(rawKey),
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
    { name: "AES-GCM", iv: toBufferSource(iv) },
    key,
    toBufferSource(enc.encode(plaintext)),
  );
  return { ciphertext: toB64(new Uint8Array(ct)), iv: toB64(iv) };
}

export async function decrypt(
  key: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
): Promise<string> {
  const pt = await getSubtleCrypto().decrypt(
    { name: "AES-GCM", iv: toBufferSource(fromB64(ivB64)) },
    key,
    toBufferSource(fromB64(ciphertextB64)),
  );
  return dec.decode(pt);
}

export async function encryptBytes(
  key: CryptoKey,
  bytes: Uint8Array,
): Promise<{ ciphertext: Uint8Array; iv: string }> {
  const iv = randomBytes(12);
  const ct = await getSubtleCrypto().encrypt(
    { name: "AES-GCM", iv: toBufferSource(iv) },
    key,
    toBufferSource(bytes),
  );
  return { ciphertext: new Uint8Array(ct), iv: toB64(iv) };
}

export async function decryptBytes(
  key: CryptoKey,
  ciphertext: Uint8Array,
  ivB64: string,
): Promise<Uint8Array> {
  const pt = await getSubtleCrypto().decrypt(
    { name: "AES-GCM", iv: toBufferSource(fromB64(ivB64)) },
    key,
    toBufferSource(ciphertext),
  );
  return new Uint8Array(pt);
}
