import { base64ToBytes } from "@kodama.page/ksp-core";

import { decrypt, decryptBytes, encrypt, encryptBytes } from "@/lib/crypto";
import {
  decryptKspBytes,
  decryptKspText,
  encryptKspBytes,
  encryptKspText,
  saveKspWorkbookEdit,
  type KspPlaceMeta,
} from "@/lib/ksp-place";
import type { KspSecrets } from "@/lib/ksp-secrets";
import { serializeKspWire } from "@/lib/ksp-wire";

/** Unified crypto session for legacy Argon2id pages and KSP-capability pages. */
export type PlaceCryptoSession =
  | {
      kind: "legacy";
      cryptoKey: CryptoKey;
    }
  | {
      kind: "ksp";
      readKey: Uint8Array;
      secrets: KspSecrets;
      editorPublicKey: string;
      slug: string;
      version: number;
      productType: string;
      storageMode: "legacy" | "bundle";
    };

export function kspSessionFromSecrets(args: {
  slug: string;
  secrets: KspSecrets;
  meta: KspPlaceMeta;
}): PlaceCryptoSession {
  return {
    kind: "ksp",
    readKey: base64ToBytes(args.secrets.readerCapability),
    secrets: args.secrets,
    editorPublicKey: args.meta.editor_public_keys[0] ?? "",
    slug: args.slug,
    version: args.meta.version ?? 1,
    productType: args.meta.product_type ?? "note",
    storageMode: args.meta.storage_mode ?? "bundle",
  };
}

/** Encrypt workbook plaintext for persistence; bumps KSP version and signs bundle edits. */
export async function encryptPlaceWorkbookForSave(
  session: PlaceCryptoSession,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string; session: PlaceCryptoSession }> {
  if (session.kind === "legacy") {
    const { ciphertext, iv } = await encrypt(session.cryptoKey, plaintext);
    return { ciphertext, iv, session };
  }

  if (session.storageMode === "bundle") {
    if (!session.secrets.editorPrivateKey) {
      throw new Error("Editor key required to save");
    }
    const result = await saveKspWorkbookEdit({
      slug: session.slug,
      workbookPlaintext: plaintext,
      readKey: session.readKey,
      editorPrivateKey: session.secrets.editorPrivateKey,
      editorPublicKey: session.editorPublicKey,
      oldVersion: session.version,
      productType: session.productType,
    });
    return {
      ciphertext: result.wireCiphertext,
      iv: result.iv,
      session: { ...session, version: result.newVersion },
    };
  }

  const newVersion = session.version + 1;
  const encrypted = await encryptKspText({
    slug: session.slug,
    plaintext,
    readKey: session.readKey,
    version: newVersion,
    productType: session.productType,
  });
  const wire = serializeKspWire({
    format: "ksp-v1",
    storage_mode: "legacy",
    version: newVersion,
    legacy: encrypted,
  });
  return {
    ciphertext: wire,
    iv: encrypted.iv,
    session: { ...session, version: newVersion },
  };
}

export async function encryptPlaceText(
  session: PlaceCryptoSession,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  if (session.kind === "legacy") return encrypt(session.cryptoKey, plaintext);
  return encryptKspText({
    slug: session.slug,
    plaintext,
    readKey: session.readKey,
    version: session.version,
    productType: session.productType,
  });
}

export async function decryptPlaceText(
  session: PlaceCryptoSession,
  ciphertext: string,
  iv: string,
): Promise<string> {
  if (session.kind === "legacy") return decrypt(session.cryptoKey, ciphertext, iv);
  return decryptKspText({
    slug: session.slug,
    ciphertextB64: ciphertext,
    iv,
    readKey: session.readKey,
    version: session.version,
    productType: session.productType,
  });
}

export async function encryptPlaceBytes(
  session: PlaceCryptoSession,
  bytes: Uint8Array,
): Promise<{ ciphertext: Uint8Array; iv: string }> {
  if (session.kind === "legacy") return encryptBytes(session.cryptoKey, bytes);
  return encryptKspBytes({
    slug: session.slug,
    bytes,
    readKey: session.readKey,
    version: session.version,
    productType: session.productType,
  });
}

export async function decryptPlaceBytes(
  session: PlaceCryptoSession,
  ciphertext: Uint8Array,
  iv: string,
): Promise<Uint8Array> {
  if (session.kind === "legacy") return decryptBytes(session.cryptoKey, ciphertext, iv);
  return decryptKspBytes({
    slug: session.slug,
    ciphertext,
    iv,
    readKey: session.readKey,
    version: session.version,
    productType: session.productType,
  });
}

export function canSignKspWorkbook(session: PlaceCryptoSession): boolean {
  if (session.kind !== "ksp") return true;
  if (session.storageMode !== "bundle") return true;
  return !!session.secrets.editorPrivateKey;
}

