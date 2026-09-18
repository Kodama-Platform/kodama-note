/** Lightweight crypto helpers with no hash-wasm (keep Argon2 off the landing/note hot path). */

export type KdfParams = {
  algo: "argon2id";
  m: number;
  t: number;
  p: number;
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

export function getSubtleCrypto(): SubtleCrypto {
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

/**
 * Copy bytes into a plain ArrayBuffer so Web Crypto accepts them.
 * Reuses the backing store when the view already covers a whole ArrayBuffer.
 */
export function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

export function newSalt(): string {
  return toB64(randomBytes(16));
}

export function randomPath(): string {
  return toB64(randomBytes(24)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
