import {
  base64ToBytes,
  buildContentAad,
  bytesToBase64,
  compressNoteText,
  createEditBundlePayload,
  createPlaceBundlePayload,
  decompressNoteText,
  decryptBytes,
  decryptPlaceBundle,
  deriveKspMaterialFromPassword,
  encryptBytes,
  keyPairFromSeed,
  readWithCapability,
  readWithPassword,
  verifyEditBundlePayload,
  verifyCreatePlaceBundlePayload,
  type PlaceBundle,
  type PlaceContent,
} from "@kodama.page/ksp-core";

import { editorSecretsFromFragment, getFragmentCapability } from "@/lib/ksp-fragment";
import type { ExistingPage, SerializableKdfParams } from "@/lib/pages";
import type { KspSecrets } from "@/lib/ksp-secrets";
import { readKspSecrets, writeKspSecrets } from "@/lib/ksp-secrets";
import {
  bundleToWireItems,
  parseKspWire,
  primaryIvFromWire,
  serializeKspWire,
  wireItemsToBundle,
  type KspWirePayload,
} from "@/lib/ksp-wire";

/** Primary workbook blob inside a KSP place bundle. */
export const WORKBOOK_NOTE_ID = "workbook";

/** KSP metadata stored in `pages.kdf_params` for places created with the protocol. */
export type KspPlaceMeta = {
  protocol: "ksp-v1";
  kdf: "argon2id" | "pbkdf2";
  version: number;
  product_type: string;
  storage_mode: "legacy" | "bundle";
  owner_public_key: string;
  editor_public_keys: string[];
  owner_signature: string;
};

export function isKspPlaceMeta(raw: unknown): raw is KspPlaceMeta {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return false;
    }
  }
  return (
    !!value &&
    typeof value === "object" &&
    (value as KspPlaceMeta).protocol === "ksp-v1" &&
    typeof (value as KspPlaceMeta).owner_public_key === "string"
  );
}

/** True when ciphertext or metadata indicates a KSP place. */
export function isKspPage(page: { kdf_params: unknown; ciphertext: string }): boolean {
  return isKspPlaceMeta(page.kdf_params) || !!parseKspWire(page.ciphertext);
}

export function resolveKspMeta(page: ExistingPage): KspPlaceMeta {
  const base = page.kdf_params as KspPlaceMeta;
  const wire = parseKspWire(page.ciphertext);
  if (wire) {
    return { ...base, version: wire.version, storage_mode: wire.storage_mode };
  }
  return {
    ...base,
    storage_mode: base.storage_mode ?? "legacy",
  };
}

export function pageToPlaceContent(page: ExistingPage): PlaceContent {
  const meta = resolveKspMeta(page);
  const wire = parseKspWire(page.ciphertext);
  if (wire?.legacy) {
    return {
      slug: page.slug,
      product_type: meta.product_type ?? "note",
      version: wire.version,
      iv: wire.legacy.iv,
      salt: page.salt,
      kdf: meta.kdf ?? "argon2id",
      ciphertext: base64ToBytes(wire.legacy.ciphertext),
    };
  }
  return {
    slug: page.slug,
    product_type: meta.product_type ?? "note",
    version: meta.version ?? 1,
    iv: page.iv,
    salt: page.salt,
    kdf: meta.kdf ?? "argon2id",
    ciphertext: base64ToBytes(page.ciphertext),
  };
}

function metaFromBundleCreate(result: Awaited<ReturnType<typeof createPlaceBundlePayload>>): KspPlaceMeta {
  return {
    protocol: "ksp-v1",
    kdf: result.metadata.kdf,
    version: result.metadata.version,
    product_type: result.metadata.product_type,
    storage_mode: "bundle",
    owner_public_key: result.metadata.owner_public_key,
    editor_public_keys: result.metadata.editor_public_keys,
    owner_signature: result.metadata.owner_signature,
  };
}

function wireFromBundle(args: {
  version: number;
  bundle: PlaceBundle;
  edit?: KspWirePayload["edit"];
}): KspWirePayload {
  return {
    format: "ksp-v1",
    storage_mode: "bundle",
    version: args.version,
    bundle: bundleToWireItems(args.bundle),
    edit: args.edit,
  };
}

/** Create a new KSP workbook place (bundle storage, signed create). */
export async function createKspWorkbookPlace(args: {
  slug: string;
  password: string;
  workbookPlaintext: string;
}): Promise<{
  ciphertext: string;
  salt: string;
  iv: string;
  kdf_params: KspPlaceMeta;
  readerCapability: string;
  editorPrivateKey: string;
  ownerPrivateKey: string;
}> {
  const result = await createPlaceBundlePayload({
    slug: args.slug,
    password: args.password,
    notes: [{ id: WORKBOOK_NOTE_ID, plaintext: args.workbookPlaintext }],
    attachments: [],
    productType: "note",
  });

  const wire = wireFromBundle({ version: result.metadata.version, bundle: result.bundle });
  const kdf_params = metaFromBundleCreate(result);

  return {
    ciphertext: serializeKspWire(wire),
    salt: result.metadata.salt,
    iv: primaryIvFromWire(wire),
    kdf_params,
    readerCapability: result.readerCapability,
    editorPrivateKey: result.editorPrivateKey,
    ownerPrivateKey: result.ownerPrivateKey,
  };
}

/** @deprecated Use createKspWorkbookPlace. */
export const createKspPlace = createKspWorkbookPlace;

export async function ensureKspSecrets(
  slug: string,
  page: ExistingPage,
  password: string,
): Promise<KspSecrets> {
  const stored = readKspSecrets(slug);
  if (stored?.editorPrivateKey && stored.readerCapability) return stored;

  const meta = resolveKspMeta(page);
  const material = await deriveKspMaterialFromPassword(password, base64ToBytes(page.salt), meta.kdf);
  const editor = await keyPairFromSeed(material.editorSeed);
  const owner = await keyPairFromSeed(material.ownerSeed);

  const secrets: KspSecrets = {
    readerCapability: bytesToBase64(material.readKey),
    editorPrivateKey: editor.privateKey,
    ownerPrivateKey: owner.privateKey,
  };

  writeKspSecrets(slug, secrets);
  return secrets;
}

export function readerSecretsFromFragment(): Pick<
  KspSecrets,
  "readerCapability" | "editorPrivateKey"
> | null {
  const editor = editorSecretsFromFragment();
  if (editor) return editor;
  const readFromUrl = getFragmentCapability("read");
  if (readFromUrl) {
    return { readerCapability: readFromUrl, editorPrivateKey: "" };
  }
  return null;
}

/** Verify KSP wire signatures before trusting decrypted content. */
export async function verifyKspPageWire(page: ExistingPage): Promise<void> {
  const meta = resolveKspMeta(page);
  const wire = parseKspWire(page.ciphertext);
  if (!wire) return;

  if (wire.storage_mode === "bundle" && wire.bundle) {
    const bundle = wireItemsToBundle(wire.bundle);
    if (wire.version === 1 && !wire.edit) {
      const ok = await verifyCreatePlaceBundlePayload(
        {
          slug: page.slug,
          product_type: meta.product_type,
          version: wire.version,
          kdf: meta.kdf,
          salt: page.salt,
          owner_public_key: meta.owner_public_key,
          editor_public_keys: meta.editor_public_keys,
          owner_signature: meta.owner_signature,
          storage_mode: "bundle",
          notes: wire.bundle.notes.map((n) => ({ id: n.id, iv: n.iv })),
          attachments: wire.bundle.attachments.map((a) => ({ id: a.id, iv: a.iv })),
        },
        bundle,
      );
      if (!ok) throw new Error("Invalid create signature");
      return;
    }

    if (wire.edit && wire.version > 1) {
      const ok = await verifyEditBundlePayload(
        {
          slug: page.slug,
          old_version: wire.edit.old_version,
          new_version: wire.edit.new_version,
          editor_public_key: wire.edit.editor_public_key,
          signature: wire.edit.signature,
          notes: wire.bundle.notes.map((n) => ({ id: n.id, iv: n.iv })),
          attachments: wire.bundle.attachments.map((a) => ({ id: a.id, iv: a.iv })),
          storage_mode: "bundle",
        },
        bundle,
        meta.editor_public_keys,
        wire.edit.old_version,
      );
      if (!ok) throw new Error("Invalid edit signature");
    }
  }
}

async function decryptWorkbookFromBundle(args: {
  page: ExistingPage;
  readKey: Uint8Array;
  wire: KspWirePayload;
}): Promise<string> {
  if (!args.wire.bundle) throw new Error("Missing bundle payload");
  const meta = resolveKspMeta(args.page);
  const bundle = wireItemsToBundle(args.wire.bundle);
  const decrypted = await decryptPlaceBundle(
    args.readKey,
    args.page.slug,
    args.wire.version,
    meta.product_type ?? "note",
    bundle,
  );
  const text = decrypted.notes.get(WORKBOOK_NOTE_ID);
  if (text == null) throw new Error("Workbook note missing from bundle");
  return text;
}

export async function decryptKspWorkbook(args: {
  page: ExistingPage;
  readKey: Uint8Array;
}): Promise<string> {
  const wire = parseKspWire(args.page.ciphertext);
  if (wire?.storage_mode === "bundle") {
    return decryptWorkbookFromBundle({ page: args.page, readKey: args.readKey, wire });
  }
  const meta = resolveKspMeta(args.page);
  return decryptKspText({
    slug: args.page.slug,
    ciphertextB64: args.page.ciphertext,
    iv: args.page.iv,
    readKey: args.readKey,
    version: meta.version,
    productType: meta.product_type,
  });
}

export async function decryptKspPlaceWithPassword(page: ExistingPage, password: string): Promise<string> {
  const wire = parseKspWire(page.ciphertext);
  if (wire?.storage_mode === "bundle" && wire.bundle) {
    const meta = resolveKspMeta(page);
    const material = await deriveKspMaterialFromPassword(password, base64ToBytes(page.salt), meta.kdf);
    return decryptWorkbookFromBundle({ page, readKey: material.readKey, wire });
  }
  return readWithPassword(password, pageToPlaceContent(page));
}

export async function decryptKspPlaceWithFragment(
  page: ExistingPage,
  readCapability?: string,
): Promise<string | null> {
  const capability =
    readCapability ??
    getFragmentCapability("read") ??
    readKspSecrets(page.slug)?.readerCapability;
  if (!capability) return null;

  const wire = parseKspWire(page.ciphertext);
  if (wire?.storage_mode === "bundle" && wire.bundle) {
    return decryptWorkbookFromBundle({ page, readKey: base64ToBytes(capability), wire });
  }
  return readWithCapability(capability, pageToPlaceContent(page));
}

/** Signed KSP bundle edit — increments version and returns wire payload for storage. */
export async function saveKspWorkbookEdit(args: {
  slug: string;
  workbookPlaintext: string;
  readKey: Uint8Array;
  editorPrivateKey: string;
  editorPublicKey: string;
  oldVersion: number;
  productType: string;
}): Promise<{ wireCiphertext: string; iv: string; newVersion: number }> {
  const { metadata, bundle } = await createEditBundlePayload({
    slug: args.slug,
    oldVersion: args.oldVersion,
    productType: args.productType,
    notes: [{ id: WORKBOOK_NOTE_ID, plaintext: args.workbookPlaintext }],
    attachments: [],
    readKey: args.readKey,
    editorPrivateKey: args.editorPrivateKey,
    editorPublicKey: args.editorPublicKey,
  });

  const wire = wireFromBundle({
    version: metadata.new_version,
    bundle,
    edit: {
      signature: metadata.signature,
      editor_public_key: metadata.editor_public_key,
      old_version: metadata.old_version,
      new_version: metadata.new_version,
    },
  });

  return {
    wireCiphertext: serializeKspWire(wire),
    iv: primaryIvFromWire(wire),
    newVersion: metadata.new_version,
  };
}

export async function encryptKspText(args: {
  slug: string;
  plaintext: string;
  readKey: Uint8Array;
  version: number;
  productType?: string;
}): Promise<{ ciphertext: string; iv: string }> {
  const productType = args.productType ?? "note";
  const encrypted = await encryptBytes(
    await compressNoteText(args.plaintext),
    args.readKey,
    buildContentAad(args.slug, args.version, productType),
  );
  return {
    ciphertext: bytesToBase64(encrypted.ciphertext),
    iv: bytesToBase64(encrypted.iv),
  };
}

export async function decryptKspText(args: {
  slug: string;
  ciphertextB64: string;
  iv: string;
  readKey: Uint8Array;
  version: number;
  productType?: string;
}): Promise<string> {
  const pt = await decryptKspBytes({
    slug: args.slug,
    ciphertext: base64ToBytes(args.ciphertextB64),
    iv: args.iv,
    readKey: args.readKey,
    version: args.version,
    productType: args.productType,
  });
  return decompressNoteText(pt);
}

export async function encryptKspBytes(args: {
  slug: string;
  bytes: Uint8Array;
  readKey: Uint8Array;
  version: number;
  productType?: string;
}): Promise<{ ciphertext: Uint8Array; iv: string }> {
  const productType = args.productType ?? "note";
  const encrypted = await encryptBytes(
    args.bytes,
    args.readKey,
    buildContentAad(args.slug, args.version, productType),
  );
  return { ciphertext: encrypted.ciphertext, iv: bytesToBase64(encrypted.iv) };
}

export async function decryptKspBytes(args: {
  slug: string;
  ciphertext: Uint8Array;
  iv: string;
  readKey: Uint8Array;
  version: number;
  productType?: string;
}): Promise<Uint8Array> {
  const productType = args.productType ?? "note";
  return decryptBytes(
    { ciphertext: args.ciphertext, iv: base64ToBytes(args.iv) },
    args.readKey,
    buildContentAad(args.slug, args.version, productType),
  );
}

export function kspMetaFromParams(params: SerializableKdfParams): KspPlaceMeta | null {
  return isKspPlaceMeta(params) ? params : null;
}
