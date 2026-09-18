import { bytesToBase64 } from "@kodama.page/core";

import { encodePlaceSignMessage } from "@/lib/gate-sign";
import type { NoteSession } from "@/lib/note-protocol";
import { composeKodamaNoteApp } from "@/lib/security-bootstrap";

/** Canonical message the Delivery Gate verifies (CBOR sorts keys). */
export function placeDocumentSignPayload(
  slug: string,
  purpose: string,
  document: Record<string, unknown>,
): Record<string, unknown> {
  return { document, purpose, slug };
}

export function canSignPlaceDocument(session: NoteSession | undefined): boolean {
  return session?.role === "owner" && !!session.ownerSignKey;
}

export function canSignPlaceWrite(session: NoteSession | undefined): boolean {
  if (!session) return false;
  if (session.role === "owner" && session.ownerSignKey) return true;
  return session.role === "editor" && !!session.editorSignKey;
}

export async function signPlaceDocument(input: {
  session: NoteSession;
  slug: string;
  purpose: string;
  document: Record<string, unknown>;
}): Promise<{ owner_public_key: string; state_signature: string }> {
  if (!canSignPlaceDocument(input.session) || !input.session.ownerSignKey) {
    throw new Error("owner signing key required");
  }
  const { security } = composeKodamaNoteApp();
  const message = encodePlaceSignMessage(input.purpose, input.slug, input.document);
  const signature = await security.signatures.sign({
    privateKey: input.session.ownerSignKey,
    message,
  });
  return {
    owner_public_key: bytesToBase64(input.session.ownerPublicKey.bytes),
    state_signature: bytesToBase64(signature),
  };
}

/** Owner or editor signature for public-tab writes (not publish/unpublish). */
export async function signPlaceWrite(input: {
  session: NoteSession;
  slug: string;
  purpose: string;
  document: Record<string, unknown>;
}): Promise<{ writer_public_key: string; state_signature: string }> {
  const privateKey = input.session.ownerSignKey ?? input.session.editorSignKey;
  if (!canSignPlaceWrite(input.session) || !privateKey) {
    throw new Error("writer signing key required");
  }
  const { security } = composeKodamaNoteApp();
  const message = encodePlaceSignMessage(input.purpose, input.slug, input.document);
  const signature = await security.signatures.sign({
    privateKey,
    message,
  });
  const publicKey =
    input.session.role === "owner"
      ? input.session.ownerPublicKey
      : await security.keys.exportPublicKey(privateKey);
  return {
    writer_public_key: bytesToBase64(publicKey.bytes),
    state_signature: bytesToBase64(signature),
  };
}
