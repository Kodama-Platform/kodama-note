import {
  base64ToBytes,
  bytesToBase64,
  encodeCbor,
  type KeyHandle,
  type PublicKeyBytes,
  type SecurityProvider,
  type Signature,
} from "@kodama.page/core";

import { KNP_PROTOCOL, KNP_SUITE } from "./constants";
import { toBufferSource } from "@/lib/crypto";

export type StateHeader = {
  readonly protocol: typeof KNP_PROTOCOL;
  readonly suite: typeof KNP_SUITE;
  readonly placeId: string;
  readonly noteId: string;
  readonly accessEpoch: number;
  readonly policyVersion: number;
  readonly policyHashB64: string;
  readonly version: number;
  readonly stateIdB64: string;
  readonly previousStateHashB64: string | null;
  readonly operation: string;
  readonly writerKeyId: string;
  readonly ciphertextHashB64: string;
  readonly manifestHashB64: string;
  readonly signatureB64: string;
};

export type SignedState = {
  readonly header: StateHeader;
  readonly stateHashB64: string;
  readonly noteEnvelopeB64: string;
  readonly manifestEnvelopeB64: string;
};

function headerBody(h: Omit<StateHeader, "signatureB64">) {
  return {
    protocol: h.protocol,
    suite: h.suite,
    placeId: h.placeId,
    noteId: h.noteId,
    accessEpoch: h.accessEpoch,
    policyVersion: h.policyVersion,
    policyHashB64: h.policyHashB64,
    version: h.version,
    stateIdB64: h.stateIdB64,
    previousStateHashB64: h.previousStateHashB64,
    operation: h.operation,
    writerKeyId: h.writerKeyId,
    ciphertextHashB64: h.ciphertextHashB64,
    manifestHashB64: h.manifestHashB64,
  };
}

async function sha256B64(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toBufferSource(bytes));
  return bytesToBase64(new Uint8Array(digest));
}

export async function hashBytesB64(bytes: Uint8Array): Promise<string> {
  return sha256B64(bytes);
}

export async function signStateHeader(
  security: SecurityProvider,
  writerPrivateKey: KeyHandle,
  unsigned: Omit<StateHeader, "signatureB64">,
): Promise<StateHeader> {
  const message = encodeCbor(headerBody(unsigned));
  const signature: Signature = await security.signatures.sign({
    privateKey: writerPrivateKey,
    message,
  });
  return { ...unsigned, signatureB64: bytesToBase64(signature) };
}

export async function stateHashB64(header: StateHeader): Promise<string> {
  return sha256B64(encodeCbor({ ...headerBody(header), signatureB64: header.signatureB64 }));
}

export async function verifyStateHeaderSignature(
  security: SecurityProvider,
  header: StateHeader,
  writerPublicKey: PublicKeyBytes | Uint8Array,
): Promise<boolean> {
  return security.signatures.verify({
    publicKey: writerPublicKey,
    message: encodeCbor(headerBody(header)),
    signature: base64ToBytes(header.signatureB64),
  });
}

export function newStateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(bytes);
}

export async function buildSignedState(
  security: SecurityProvider,
  input: {
    readonly writerPrivateKey: KeyHandle;
    readonly placeId: string;
    readonly noteId: string;
    readonly accessEpoch: number;
    readonly policyVersion: number;
    readonly policyHashB64: string;
    readonly version: number;
    readonly previousStateHashB64: string | null;
    readonly operation: string;
    readonly writerKeyId: string;
    readonly noteEnvelope: Uint8Array;
    readonly manifestEnvelope: Uint8Array;
  },
): Promise<SignedState> {
  const unsigned: Omit<StateHeader, "signatureB64"> = {
    protocol: KNP_PROTOCOL,
    suite: KNP_SUITE,
    placeId: input.placeId,
    noteId: input.noteId,
    accessEpoch: input.accessEpoch,
    policyVersion: input.policyVersion,
    policyHashB64: input.policyHashB64,
    version: input.version,
    stateIdB64: newStateId(),
    previousStateHashB64: input.previousStateHashB64,
    operation: input.operation,
    writerKeyId: input.writerKeyId,
    ciphertextHashB64: await hashBytesB64(input.noteEnvelope),
    manifestHashB64: await hashBytesB64(input.manifestEnvelope),
  };
  const header = await signStateHeader(security, input.writerPrivateKey, unsigned);
  return {
    header,
    stateHashB64: await stateHashB64(header),
    noteEnvelopeB64: bytesToBase64(input.noteEnvelope),
    manifestEnvelopeB64: bytesToBase64(input.manifestEnvelope),
  };
}
