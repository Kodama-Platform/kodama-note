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
import { toBufferSource } from "@/lib/crypto-utils";

export type EditorCertificate = {
  readonly noteId: string;
  readonly editorPublicKeyB64: string;
  readonly editorCapabilityId: string;
  readonly allowedOperations: readonly string[];
  readonly accessEpoch: number;
  readonly policyVersion: number;
  readonly signatureB64: string;
};

export type NotePolicy = {
  readonly noteId: string;
  readonly ownerId: string;
  readonly accessEpoch: number;
  readonly policyVersion: number;
  readonly previousPolicyHashB64: string | null;
  readonly activeEditorCertificateHashesB64: readonly string[];
  readonly minimumProtocol: string;
  readonly minimumSuite: string;
  readonly signatureB64: string;
};

export type NotePolicyBundle = {
  readonly policy: NotePolicy;
  readonly policyHashB64: string;
  readonly editorCertificates: readonly EditorCertificate[];
};

async function sha256B64(security: SecurityProvider, bytes: Uint8Array): Promise<string> {
  // Use Web Crypto via subtle when available; security provider has no hash facet.
  const digest = await crypto.subtle.digest("SHA-256", toBufferSource(bytes));
  return bytesToBase64(new Uint8Array(digest));
}

function certBody(cert: Omit<EditorCertificate, "signatureB64">) {
  return {
    noteId: cert.noteId,
    editorPublicKeyB64: cert.editorPublicKeyB64,
    editorCapabilityId: cert.editorCapabilityId,
    allowedOperations: [...cert.allowedOperations],
    accessEpoch: cert.accessEpoch,
    policyVersion: cert.policyVersion,
  };
}

function policyBody(policy: Omit<NotePolicy, "signatureB64">) {
  return {
    noteId: policy.noteId,
    ownerId: policy.ownerId,
    accessEpoch: policy.accessEpoch,
    policyVersion: policy.policyVersion,
    previousPolicyHashB64: policy.previousPolicyHashB64,
    activeEditorCertificateHashesB64: [...policy.activeEditorCertificateHashesB64],
    minimumProtocol: policy.minimumProtocol,
    minimumSuite: policy.minimumSuite,
  };
}

export async function hashEditorCertificate(
  security: SecurityProvider,
  cert: EditorCertificate,
): Promise<string> {
  return sha256B64(security, encodeCbor({ ...certBody(cert), signatureB64: cert.signatureB64 }));
}

export async function issueEditorCertificate(
  security: SecurityProvider,
  input: {
    readonly ownerSignKey: KeyHandle;
    readonly noteId: string;
    readonly editorPublicKey: PublicKeyBytes;
    readonly editorCapabilityId: string;
    readonly accessEpoch: number;
    readonly policyVersion: number;
    readonly allowedOperations?: readonly string[];
  },
): Promise<EditorCertificate> {
  const body = {
    noteId: input.noteId,
    editorPublicKeyB64: bytesToBase64(input.editorPublicKey.bytes),
    editorCapabilityId: input.editorCapabilityId,
    allowedOperations: [...(input.allowedOperations ?? ["edit"])],
    accessEpoch: input.accessEpoch,
    policyVersion: input.policyVersion,
  };
  const message = encodeCbor(body);
  const signature: Signature = await security.signatures.sign({
    privateKey: input.ownerSignKey,
    message,
  });
  return { ...body, signatureB64: bytesToBase64(signature) };
}

export async function signPolicy(
  security: SecurityProvider,
  input: {
    readonly ownerSignKey: KeyHandle;
    readonly noteId: string;
    readonly ownerId: string;
    readonly accessEpoch: number;
    readonly policyVersion: number;
    readonly previousPolicyHashB64: string | null;
    readonly editorCertificates: readonly EditorCertificate[];
  },
): Promise<NotePolicyBundle> {
  const hashes: string[] = [];
  for (const cert of input.editorCertificates) {
    hashes.push(await hashEditorCertificate(security, cert));
  }
  const body = {
    noteId: input.noteId,
    ownerId: input.ownerId,
    accessEpoch: input.accessEpoch,
    policyVersion: input.policyVersion,
    previousPolicyHashB64: input.previousPolicyHashB64,
    activeEditorCertificateHashesB64: hashes,
    minimumProtocol: KNP_PROTOCOL,
    minimumSuite: KNP_SUITE,
  };
  const message = encodeCbor(body);
  const signature = await security.signatures.sign({
    privateKey: input.ownerSignKey,
    message,
  });
  const policy: NotePolicy = { ...body, signatureB64: bytesToBase64(signature) };
  const policyHashB64 = await sha256B64(
    security,
    encodeCbor({ ...policyBody(policy), signatureB64: policy.signatureB64 }),
  );
  return { policy, policyHashB64, editorCertificates: input.editorCertificates };
}

export async function verifyPolicySignature(
  security: SecurityProvider,
  policy: NotePolicy,
  ownerPublicKey: PublicKeyBytes | Uint8Array,
): Promise<boolean> {
  const message = encodeCbor(policyBody(policy));
  return security.signatures.verify({
    publicKey: ownerPublicKey,
    message,
    signature: base64ToBytes(policy.signatureB64),
  });
}

export async function verifyEditorCertificate(
  security: SecurityProvider,
  cert: EditorCertificate,
  ownerPublicKey: PublicKeyBytes | Uint8Array,
): Promise<boolean> {
  const message = encodeCbor(certBody(cert));
  return security.signatures.verify({
    publicKey: ownerPublicKey,
    message,
    signature: base64ToBytes(cert.signatureB64),
  });
}
