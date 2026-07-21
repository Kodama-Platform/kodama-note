import { bytesToBase64 } from "@kodama.page/ksp-core";

import type { PlaceCryptoSession } from "@/lib/crypto-context";
import type { KspSecrets } from "@/lib/ksp-secrets";

export function resolveShareCapabilities(args: {
  session: PlaceCryptoSession;
  stored: KspSecrets | null;
  readFromUrl: string | null;
  editorFromUrl?: string | null;
}): { readerCapability: string | null; editorPrivateKey: string | null } {
  if (args.session.kind === "ksp") {
    const readerFromKey =
      args.session.readKey.length > 0 ? bytesToBase64(args.session.readKey) : null;
    const readerCapability =
      readerFromKey ||
      args.session.secrets.readerCapability ||
      args.stored?.readerCapability ||
      args.readFromUrl ||
      null;
    const editorPrivateKey =
      args.session.secrets.editorPrivateKey ||
      args.stored?.editorPrivateKey ||
      args.editorFromUrl ||
      null;
    return {
      readerCapability: readerCapability || null,
      editorPrivateKey: editorPrivateKey || null,
    };
  }

  const editorPrivateKey =
    args.stored?.editorPrivateKey || args.editorFromUrl || null;

  return {
    readerCapability: args.stored?.readerCapability ?? args.readFromUrl ?? null,
    editorPrivateKey: editorPrivateKey || null,
  };
}

/** Keep sessionStorage in sync so share + save survive refresh within the tab. */
export function syncKspSecretsFromSession(
  slug: string,
  session: PlaceCryptoSession,
  write: (slug: string, secrets: KspSecrets) => void,
): void {
  if (session.kind !== "ksp") return;
  const readerCapability =
    (session.readKey.length > 0 ? bytesToBase64(session.readKey) : "") ||
    session.secrets.readerCapability;
  if (!readerCapability) return;
  write(slug, {
    readerCapability,
    editorPrivateKey: session.secrets.editorPrivateKey,
    ownerPrivateKey: session.secrets.ownerPrivateKey,
  });
}
