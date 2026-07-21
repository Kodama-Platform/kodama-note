import { base64ToBytes } from "@kodama.page/ksp-core";

import {
  getFragmentCapability,
  isLegacyEditorFragment,
  LEGACY_EDITOR_SENTINEL,
} from "@/lib/ksp-fragment";

import {
  decrypt,
  deriveRawKeyBytes,
  fromB64,
  importAesKeyFromRaw,
  normalizeKdfParams,
  toB64,
  unlockErrorMessage,
  type KdfParams,
} from "@/lib/crypto";
import { kspSessionFromSecrets, type PlaceCryptoSession } from "@/lib/crypto-context";
import type { ExistingPage } from "@/lib/pages";
import {
  decryptKspPlaceWithFragment,
  decryptKspPlaceWithPassword,
  decryptKspWorkbook,
  ensureKspSecrets,
  isKspPage,
  isKspPlaceMeta,
  resolveKspMeta,
  verifyKspPageWire,
} from "@/lib/ksp-place";
import { readKspSecrets, writeKspSecrets, type KspSecrets } from "@/lib/ksp-secrets";
import { resolveUnlockCapability, type UnlockCapability } from "@/lib/unlock-capability";

export type UnlockedPlace = {
  crypto: PlaceCryptoSession;
  plaintext: string;
  capability: UnlockCapability;
};

function isDecryptFailure(err: unknown): boolean {
  return err instanceof DOMException && err.name === "OperationError";
}

async function unlockLegacyWithReadCapability(
  page: ExistingPage,
  readCapability: string,
  grantEdit = false,
): Promise<UnlockedPlace> {
  const key = await importAesKeyFromRaw(fromB64(readCapability));
  const plaintext = await decrypt(key, page.ciphertext, page.iv);
  writeKspSecrets(page.slug, {
    readerCapability: readCapability,
    editorPrivateKey: grantEdit ? LEGACY_EDITOR_SENTINEL : "",
    ownerPrivateKey: "",
  });
  return {
    plaintext,
    crypto: { kind: "legacy", cryptoKey: key },
    capability: grantEdit
      ? resolveUnlockCapability({ hasEditorSecrets: true })
      : resolveUnlockCapability({ hasReadCapability: true }),
  };
}

async function unlockKspWithReadCapability(
  page: ExistingPage,
  readCapability: string,
  editorPrivateKey = "",
): Promise<UnlockedPlace> {
  if (!isKspPlaceMeta(page.kdf_params)) {
    throw new Error("Invalid KSP place metadata");
  }
  await verifyKspPageWire(page);
  const meta = resolveKspMeta(page);
  const plaintext = await decryptKspPlaceWithFragment(page, readCapability);
  if (plaintext == null) throw new Error("Could not decrypt with read capability");

  const editorFromUrl = getFragmentCapability("editor") || editorPrivateKey;
  writeKspSecrets(page.slug, {
    readerCapability: readCapability,
    editorPrivateKey: editorFromUrl,
    ownerPrivateKey: readKspSecrets(page.slug)?.ownerPrivateKey ?? "",
  });
  const secrets = readKspSecrets(page.slug)!;
  return {
    plaintext,
    crypto: kspSessionFromSecrets({ slug: page.slug, secrets, meta }),
    capability: resolveUnlockCapability({
      hasEditorSecrets: !!editorFromUrl && !isLegacyEditorFragment(editorFromUrl),
      hasReadCapability: true,
    }),
  };
}

/** Try `#read=` (or an explicit capability) — used for share-link visits without a password. */
async function unlockWithReadCapability(
  page: ExistingPage,
  readCapability: string,
  editorPrivateKey = "",
): Promise<UnlockedPlace> {
  const editorFromUrl = getFragmentCapability("editor") || editorPrivateKey;
  const legacyEditor = isLegacyEditorFragment(editorFromUrl);
  const failures: unknown[] = [];

  if (isKspPlaceMeta(page.kdf_params) && !legacyEditor) {
    try {
      return await unlockKspWithReadCapability(page, readCapability, editorFromUrl);
    } catch (err) {
      failures.push(err);
    }
  }

  if (!isKspPage(page) || legacyEditor) {
    try {
      return await unlockLegacyWithReadCapability(page, readCapability, legacyEditor);
    } catch (err) {
      failures.push(err);
    }
  }

  const decryptFailure = failures.find(isDecryptFailure);
  if (decryptFailure) throw decryptFailure;
  if (failures.length === 1) throw failures[0];
  throw new Error("Could not decrypt with read capability");
}

async function unlockKspWithPassword(
  page: ExistingPage,
  password: string,
  viaShareLink: boolean,
  hasReadFragment: boolean,
): Promise<UnlockedPlace> {
  if (!isKspPlaceMeta(page.kdf_params)) {
    throw new Error("Invalid KSP place metadata");
  }
  await verifyKspPageWire(page);
  const meta = resolveKspMeta(page);

  const plaintext = await decryptKspPlaceWithPassword(page, password);
  const secrets = await ensureKspSecrets(page.slug, page, password);
  const stored = readKspSecrets(page.slug) ?? secrets;

  return {
    plaintext,
    crypto: kspSessionFromSecrets({ slug: page.slug, secrets: stored, meta }),
    capability: resolveUnlockCapability({
      hasEditorSecrets: !!stored.editorPrivateKey,
      hasReadCapability: hasReadFragment || viaShareLink,
      unlockedWithPassword: true,
    }),
  };
}

async function unlockLegacyWithPassword(page: ExistingPage, password: string): Promise<UnlockedPlace> {
  const kdfParams = normalizeKdfParams(page.kdf_params) as KdfParams;
  const rawKey = await deriveRawKeyBytes(password, page.salt, kdfParams);
  const key = await importAesKeyFromRaw(rawKey);
  const plaintext = await decrypt(key, page.ciphertext, page.iv);
  writeKspSecrets(page.slug, {
    readerCapability: toB64(rawKey),
    editorPrivateKey: LEGACY_EDITOR_SENTINEL,
    ownerPrivateKey: "",
  });
  return {
    plaintext,
    crypto: { kind: "legacy", cryptoKey: key },
    capability: resolveUnlockCapability({ unlockedWithPassword: true }),
  };
}

/** Unlock with pasted/imported KSP editor capability JSON (out-of-band sharing). */
export async function unlockPlaceWithEditorImport(args: {
  page: ExistingPage;
  secrets: Pick<KspSecrets, "readerCapability" | "editorPrivateKey">;
}): Promise<UnlockedPlace> {
  if (!isKspPlaceMeta(args.page.kdf_params)) {
    throw new Error("Editor capability import requires a KSP place");
  }
  await verifyKspPageWire(args.page);
  const meta = resolveKspMeta(args.page);
  const secrets: KspSecrets = {
    readerCapability: args.secrets.readerCapability,
    editorPrivateKey: args.secrets.editorPrivateKey,
    ownerPrivateKey: "",
  };
  writeKspSecrets(args.page.slug, secrets);
  const plaintext = await decryptKspWorkbook({
    page: args.page,
    readKey: base64ToBytes(secrets.readerCapability),
  });
  return {
    plaintext,
    crypto: kspSessionFromSecrets({ slug: args.page.slug, secrets, meta }),
    capability: resolveUnlockCapability({ hasEditorSecrets: true }),
  };
}

export async function unlockPlace(args: {
  page: ExistingPage;
  password?: string;
  viaShareLink?: boolean;
}): Promise<UnlockedPlace> {
  const { page, password, viaShareLink = false } = args;
  const readFromUrl = getFragmentCapability("read");
  const editorFromUrl = getFragmentCapability("editor");

  // Share-link visit: no password — open from URL capabilities only.
  if (!password && readFromUrl) {
    return unlockWithReadCapability(page, readFromUrl, editorFromUrl ?? "");
  }

  if (viaShareLink && !password && !readFromUrl) {
    const stored = readKspSecrets(page.slug);
    if (stored?.readerCapability) {
      try {
        return await unlockWithReadCapability(
          page,
          stored.readerCapability,
          stored.editorPrivateKey,
        );
      } catch {
        /* fall through to password */
      }
    }
  }

  if (!password) throw new Error("Password required");

  // Password unlock wins over `#read=` so owners regain full edit keys after a read-only link.
  try {
    if (isKspPage(page)) {
      return await unlockKspWithPassword(page, password, viaShareLink, !!readFromUrl);
    }
    return await unlockLegacyWithPassword(page, password);
  } catch (err) {
    if (readFromUrl) {
      try {
        return await unlockWithReadCapability(page, readFromUrl, editorFromUrl ?? "");
      } catch {
        /* keep original password error */
      }
    }
    throw err;
  }
}

export { unlockErrorMessage };
