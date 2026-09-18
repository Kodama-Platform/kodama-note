import { createKnpSession, type PlaceCryptoSession } from "@/lib/crypto-context";
import {
  decodeEditorCapability,
  decodeReaderCapability,
  encodeCapabilityFragment,
  getFragmentCapability,
} from "@/lib/knp-fragment";
import { writeKnpSecrets } from "@/lib/knp-secrets";
import { mergePublicAndPrivate } from "@/lib/tab-visibility";
import { serializeWorkbook } from "@/lib/workbook";
import type { ExistingPage } from "@/lib/page-query";
import { composeKodamaNoteApp } from "@/lib/security-bootstrap";
import { resolveUnlockCapability, type UnlockCapability } from "@/lib/unlock-capability";

export type UnlockedPlace = {
  crypto: PlaceCryptoSession;
  plaintext: string;
  capability: UnlockCapability;
};

export { unlockErrorMessage } from "@/lib/crypto-utils";

const NOT_KNP_MESSAGE = "This note is not KNP-1. Create a new note.";

/**
 * Public GET /{slug} is a place identity + public tabs. It must not include the
 * private envelope, so `kdf_params.protocol` is often missing there.
 * Only reject when the row explicitly names a different protocol.
 */
export function isKnpUnlockCandidate(page: ExistingPage): boolean {
  const meta = page.kdf_params;
  if (!meta || typeof meta !== "object") return true;
  const protocol = (meta as { protocol?: unknown }).protocol;
  if (typeof protocol !== "string" || protocol.length === 0) return true;
  return protocol === "knp-1";
}

function rethrowUnlockError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/not a KNP-1/i.test(message)) {
    throw new Error(NOT_KNP_MESSAGE);
  }
  throw error;
}

export async function unlockPlace(args: {
  page: ExistingPage;
  password?: string;
  viaShareLink?: boolean;
}): Promise<UnlockedPlace> {
  const { page, password } = args;
  if (!isKnpUnlockCandidate(page)) {
    throw new Error(NOT_KNP_MESSAGE);
  }

  try {
    const { note } = composeKodamaNoteApp();

    const editorFrag = getFragmentCapability("editor");
    if (editorFrag) {
      const cap = decodeEditorCapability(editorFrag);
      if (!cap) throw new Error("Invalid editor capability");
      const unlocked = await note.unlockWithEditorCapability({ slug: page.slug, capability: cap });
      writeKnpSecrets(page.slug, {
        readerCapability: encodeCapabilityFragment(cap),
        editorCapability: encodeCapabilityFragment(cap),
        isOwner: false,
      });
      return {
        crypto: createKnpSession(unlocked.session),
        plaintext: serializeWorkbook(mergePublicAndPrivate(page.public_tabs ?? [], unlocked.workbook)),
        capability: resolveUnlockCapability({ hasEditorSecrets: true }),
      };
    }

    const readFrag = getFragmentCapability("read");
    if (readFrag) {
      const cap = decodeReaderCapability(readFrag);
      if (!cap) throw new Error("Invalid reader capability");
      const unlocked = await note.unlockWithReaderCapability({ slug: page.slug, capability: cap });
      writeKnpSecrets(page.slug, {
        readerCapability: encodeCapabilityFragment(cap),
        editorCapability: "",
        isOwner: false,
      });
      return {
        crypto: createKnpSession(unlocked.session),
        plaintext: serializeWorkbook(mergePublicAndPrivate(page.public_tabs ?? [], unlocked.workbook)),
        capability: resolveUnlockCapability({ hasReadCapability: true }),
      };
    }

    if (!password) {
      throw new Error("Password required");
    }

    const unlocked = await note.unlockWithPassword({ slug: page.slug, password });
    const readerCap = await note.issueReaderCapability(unlocked.session);
    writeKnpSecrets(page.slug, {
      readerCapability: encodeCapabilityFragment(readerCap),
      editorCapability: "",
      isOwner: true,
    });
    return {
      crypto: createKnpSession(unlocked.session),
      plaintext: serializeWorkbook(mergePublicAndPrivate(page.public_tabs ?? [], unlocked.workbook)),
      capability: resolveUnlockCapability({ hasEditorSecrets: true }),
    };
  } catch (error) {
    rethrowUnlockError(error);
  }
}

export async function unlockPlaceWithEditorImport(args: {
  page: ExistingPage;
  editorCapability: string;
}): Promise<UnlockedPlace> {
  const cap = decodeEditorCapability(args.editorCapability);
  if (!cap) throw new Error("Invalid editor capability import");
  const { note } = composeKodamaNoteApp();
  const unlocked = await note.unlockWithEditorCapability({
    slug: args.page.slug,
    capability: cap,
  });
  writeKnpSecrets(args.page.slug, {
    readerCapability: encodeCapabilityFragment(cap),
    editorCapability: encodeCapabilityFragment(cap),
    isOwner: false,
  });
  return {
    crypto: createKnpSession(unlocked.session),
    plaintext: serializeWorkbook(
      mergePublicAndPrivate(args.page.public_tabs ?? [], unlocked.workbook),
    ),
    capability: resolveUnlockCapability({ hasEditorSecrets: true }),
  };
}
