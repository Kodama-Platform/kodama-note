/**
 * Kodama Note Protocol (KNP-1) — product logic over KSC interfaces only.
 * Imports: `@kodama.page/core` (+ local delivery / workbook types).
 */

import type {
  AttachmentTransportManifest,
  CompressionPolicy,
  EncryptedChunk,
  KeyHandle,
  PasswordProtectedMasterKey,
  PublicKeyBytes,
  SecurityProvider,
  WrappedKey,
} from "@kodama.page/core";
import {
  TEST_ARGON2ID_PARAMS,
  base64ToBytes,
  bytesToBase64,
  clearBytes,
} from "@kodama.page/core";

import type { WorkbookPayload } from "@/lib/workbook";
import { createEmptyWorkbook } from "@/lib/workbook";

import {
  assertCheckpointAccepts,
  loadCheckpoint,
  saveCheckpoint,
  type NoteCheckpoint,
} from "./checkpoint";
import {
  KNP_PRODUCT_ID,
  KNP_PROTOCOL,
  KNP_SUITE,
  OBJECT_ID_WORKBOOK,
} from "./constants";
import { noteContentContext, noteManifestContext } from "./context";
import type { KnpPlaceMeta, NoteDeliveryClient } from "./delivery";
import {
  issueEditorCertificate,
  signPolicy,
  verifyPolicySignature,
  type NotePolicyBundle,
} from "./policy";
import {
  deserializeManifestDoc,
  deserializeWorkbookBytes,
  serializeManifestDoc,
  serializeWorkbookBytes,
  type NoteAttachmentManifestDoc,
} from "./serialize";
import {
  buildSignedState,
  hashBytesB64,
  verifyStateHeaderSignature,
  type SignedState,
} from "./state";
import { encodeWrapAad, ownerCapabilityId } from "./wrap-aad";
import { toBufferSource } from "@/lib/crypto";

export type NoteRole = "owner" | "editor" | "reader";

export type NoteProtocolDeps = {
  readonly security: SecurityProvider;
  readonly delivery: NoteDeliveryClient;
  /** Optional KSC envelope compression policy; omit → never (KSC default). */
  readonly compression?: CompressionPolicy;
};

export type NoteSession = {
  readonly role: NoteRole;
  readonly placeId: string;
  readonly slug: string;
  readonly contentKey: KeyHandle;
  readonly ownerSignKey?: KeyHandle;
  readonly editorSignKey?: KeyHandle;
  readonly ownerPublicKey: PublicKeyBytes;
  readonly ownerId: string;
  readonly epoch: number;
  readonly version: number;
  readonly policy: NotePolicyBundle;
  readonly state: SignedState;
  readonly protectedMasterKey: PasswordProtectedMasterKey;
  readonly ownerWrappedCek: WrappedKey;
  readonly ownerWrappedSignSeed: WrappedKey;
  readonly checkpoint: NoteCheckpoint | null;
};

export type ReaderCapability = {
  readonly v: 1;
  readonly protocol: typeof KNP_PROTOCOL;
  readonly placeId: string;
  readonly noteId: string;
  readonly capabilityId: string;
  readonly epoch: number;
  readonly ownerId: string;
  readonly readerSecretB64: string;
  readonly wrappedCek: WrappedKey;
  readonly checkpoint?: NoteCheckpoint;
};

export type EditorCapability = ReaderCapability & {
  readonly editorPrivateKeyB64: string;
  readonly editorPublicKeyB64: string;
  readonly editorCapabilityId: string;
};

async function ownerIdFromPublicKey(pk: PublicKeyBytes): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toBufferSource(pk.bytes));
  return bytesToBase64(new Uint8Array(digest));
}

function isProtectedMasterKey(value: unknown): value is PasswordProtectedMasterKey {
  return (
    !!value &&
    typeof value === "object" &&
    (value as PasswordProtectedMasterKey).version === 1 &&
    (value as PasswordProtectedMasterKey).suite === "KSC_V1"
  );
}

function isWrappedKey(value: unknown): value is WrappedKey {
  return (
    !!value &&
    typeof value === "object" &&
    (value as WrappedKey).suite === "KSC_V1" &&
    (value as WrappedKey).nonce instanceof Uint8Array &&
    (value as WrappedKey).ciphertext instanceof Uint8Array
  );
}

/** Revive WrappedKey / PasswordProtectedMasterKey from JSON (base64 fields). */
export function reviveProtectedMasterKey(raw: unknown): PasswordProtectedMasterKey {
  if (isProtectedMasterKey(raw) && raw.salt instanceof Uint8Array) return raw;
  const o = raw as {
    version: 1;
    suite: "KSC_V1";
    kdf: PasswordProtectedMasterKey["kdf"];
    salt: string | Uint8Array;
    nonce: string | Uint8Array;
    wrappedKey: string | Uint8Array;
  };
  return {
    version: 1,
    suite: "KSC_V1",
    kdf: o.kdf,
    salt: typeof o.salt === "string" ? base64ToBytes(o.salt) : o.salt,
    nonce: (typeof o.nonce === "string" ? base64ToBytes(o.nonce) : o.nonce) as PasswordProtectedMasterKey["nonce"],
    wrappedKey: (typeof o.wrappedKey === "string"
      ? base64ToBytes(o.wrappedKey)
      : o.wrappedKey) as PasswordProtectedMasterKey["wrappedKey"],
  };
}

export function reviveWrappedKey(raw: unknown): WrappedKey {
  if (isWrappedKey(raw)) return raw;
  const o = raw as { suite: "KSC_V1"; nonce: string | Uint8Array; ciphertext: string | Uint8Array };
  return {
    suite: "KSC_V1",
    nonce: (typeof o.nonce === "string" ? base64ToBytes(o.nonce) : o.nonce) as WrappedKey["nonce"],
    ciphertext: (typeof o.ciphertext === "string"
      ? base64ToBytes(o.ciphertext)
      : o.ciphertext) as WrappedKey["ciphertext"],
  };
}

export function serializeProtectedMasterKey(pk: PasswordProtectedMasterKey): unknown {
  return {
    version: pk.version,
    suite: pk.suite,
    kdf: pk.kdf,
    salt: bytesToBase64(pk.salt),
    nonce: bytesToBase64(pk.nonce),
    wrappedKey: bytesToBase64(pk.wrappedKey),
  };
}

export function serializeWrappedKey(wk: WrappedKey): unknown {
  return {
    suite: wk.suite,
    nonce: bytesToBase64(wk.nonce),
    ciphertext: bytesToBase64(wk.ciphertext),
  };
}

async function* bytesSource(data: Uint8Array): AsyncGenerator<Uint8Array> {
  const chunk = 64 * 1024;
  if (data.byteLength === 0) return;
  for (let i = 0; i < data.byteLength; i += chunk) {
    yield data.subarray(i, Math.min(i + chunk, data.byteLength));
  }
}

export function createNoteProtocol(deps: NoteProtocolDeps) {
  const { security, delivery, compression } = deps;

  async function wrapCekUnderKey(input: {
    readonly wrappingKey: KeyHandle;
    readonly contentKey: KeyHandle;
    readonly placeId: string;
    readonly noteId: string;
    readonly epoch: number;
    readonly capabilityId: string;
    readonly role: "owner" | "reader" | "editor";
    readonly ownerId: string;
  }): Promise<WrappedKey> {
    const aad = encodeWrapAad({
      placeId: input.placeId,
      noteId: input.noteId,
      epoch: input.epoch,
      capabilityId: input.capabilityId,
      role: input.role,
      ownerId: input.ownerId,
    });
    return security.keys.wrapSymmetricKey({
      wrappingKey: input.wrappingKey,
      keyToWrap: input.contentKey,
      aad,
    });
  }

  async function unwrapCek(input: {
    readonly wrappingKey: KeyHandle;
    readonly wrapped: WrappedKey;
    readonly placeId: string;
    readonly noteId: string;
    readonly epoch: number;
    readonly capabilityId: string;
    readonly role: "owner" | "reader" | "editor";
    readonly ownerId: string;
  }): Promise<KeyHandle> {
    const aad = encodeWrapAad({
      placeId: input.placeId,
      noteId: input.noteId,
      epoch: input.epoch,
      capabilityId: input.capabilityId,
      role: input.role,
      ownerId: input.ownerId,
    });
    return security.keys.unwrapSymmetricKey({
      wrappingKey: input.wrappingKey,
      wrappedKey: input.wrapped,
      aad,
      purpose: "content-encryption",
    });
  }

  async function encryptWorkbookState(input: {
    readonly contentKey: KeyHandle;
    readonly placeId: string;
    readonly epoch: number;
    readonly version: number;
    readonly workbook: WorkbookPayload;
    readonly manifestDoc: NoteAttachmentManifestDoc;
  }) {
    const noteCtx = noteContentContext({
      placeId: input.placeId,
      objectVersion: input.version,
      epoch: input.epoch,
    });
    const manifestCtx = noteManifestContext({
      placeId: input.placeId,
      objectVersion: input.version,
      epoch: input.epoch,
    });
    const { encoded: noteEnvelope } = await security.envelopes.create({
      key: input.contentKey,
      plaintext: serializeWorkbookBytes(input.workbook),
      context: noteCtx,
      ...(compression !== undefined ? { compression } : {}),
    });
    const { encoded: manifestEnvelope } = await security.envelopes.create({
      key: input.contentKey,
      plaintext: serializeManifestDoc(input.manifestDoc),
      context: manifestCtx,
      ...(compression !== undefined ? { compression } : {}),
    });
    return { noteEnvelope, manifestEnvelope, noteCtx, manifestCtx };
  }

  async function openWorkbookState(input: {
    readonly contentKey: KeyHandle;
    readonly placeId: string;
    readonly epoch: number;
    readonly version: number;
    readonly noteEnvelope: Uint8Array;
    readonly manifestEnvelope: Uint8Array;
  }) {
    const noteCtx = noteContentContext({
      placeId: input.placeId,
      objectVersion: input.version,
      epoch: input.epoch,
    });
    const manifestCtx = noteManifestContext({
      placeId: input.placeId,
      objectVersion: input.version,
      epoch: input.epoch,
    });
    const noteBytes = await security.envelopes.open({
      key: input.contentKey,
      envelope: input.noteEnvelope,
      context: noteCtx,
    });
    const manifestBytes = await security.envelopes.open({
      key: input.contentKey,
      envelope: input.manifestEnvelope,
      context: manifestCtx,
    });
    return {
      workbook: deserializeWorkbookBytes(noteBytes),
      manifestDoc: deserializeManifestDoc(manifestBytes),
    };
  }

  return {
    /**
     * Create a new place: password → master + owner sign keys, CEK, policy, state v0.
     */
    async createPlace(input: {
      readonly slug: string;
      readonly password: string;
      readonly burnMode: string;
      readonly workbook?: WorkbookPayload;
      readonly argonParams?: Parameters<SecurityProvider["passwords"]["createProtectedMasterKey"]>[0]["params"];
    }): Promise<{ session: NoteSession; workbook: WorkbookPayload }> {
      const placeId = input.slug;
      const noteId = OBJECT_ID_WORKBOOK;
      const epoch = 0;
      const version = 0;

      const { masterKey, protectedKey } = await security.passwords.createProtectedMasterKey({
        password: input.password,
        params: input.argonParams ?? TEST_ARGON2ID_PARAMS,
      });

      const ownerPair = await security.keys.generateSigningKey();
      const ownerId = await ownerIdFromPublicKey(ownerPair.publicKey);
      const contentKey = await security.keys.generateSymmetricKey("content-encryption");

      // Derive owner wrapping key material from master via export+import as wrapping purpose.
      const masterBytes = await security.keys.exportSymmetricKey(masterKey);
      let ownerWrapKey: KeyHandle;
      try {
        ownerWrapKey = await security.keys.importSymmetricKey("wrapping", masterBytes);
      } finally {
        clearBytes(masterBytes);
      }

      const ownerWrappedCek = await wrapCekUnderKey({
        wrappingKey: ownerWrapKey,
        contentKey,
        placeId,
        noteId,
        epoch,
        capabilityId: ownerCapabilityId(placeId),
        role: "owner",
        ownerId,
      });

      const ownerSeed = await security.keys.exportSigningSeed(ownerPair.privateKey);
      let ownerSeedHandle: KeyHandle;
      let ownerWrappedSignSeed: WrappedKey;
      try {
        ownerSeedHandle = await security.keys.importSymmetricKey("wrapping", ownerSeed);
        ownerWrappedSignSeed = await wrapCekUnderKey({
          wrappingKey: ownerWrapKey,
          contentKey: ownerSeedHandle,
          placeId,
          noteId,
          epoch,
          capabilityId: `owner-sign:${placeId}`,
          role: "owner",
          ownerId,
        });
      } finally {
        clearBytes(ownerSeed);
      }

      const policy = await signPolicy(security, {
        ownerSignKey: ownerPair.privateKey,
        noteId,
        ownerId,
        accessEpoch: epoch,
        policyVersion: 1,
        previousPolicyHashB64: null,
        editorCertificates: [],
      });

      const workbook = input.workbook ?? createEmptyWorkbook();
      const emptyManifest: NoteAttachmentManifestDoc = { v: 1, files: [] };
      const { noteEnvelope, manifestEnvelope } = await encryptWorkbookState({
        contentKey,
        placeId,
        epoch,
        version,
        workbook,
        manifestDoc: emptyManifest,
      });

      const state = await buildSignedState(security, {
        writerPrivateKey: ownerPair.privateKey,
        placeId,
        noteId,
        accessEpoch: epoch,
        policyVersion: policy.policy.policyVersion,
        policyHashB64: policy.policyHashB64,
        version,
        previousStateHashB64: null,
        operation: "create",
        writerKeyId: `owner:${ownerId}`,
        noteEnvelope,
        manifestEnvelope,
      });

      const meta: KnpPlaceMeta = {
        protocol: KNP_PROTOCOL,
        suite: KNP_SUITE,
        product_type: KNP_PRODUCT_ID,
        owner_public_key: bytesToBase64(ownerPair.publicKey.bytes),
        owner_id: ownerId,
        epoch,
        version,
        policy,
        state,
        protected_master_key: serializeProtectedMasterKey(protectedKey),
        owner_wrapped_cek: serializeWrappedKey(ownerWrappedCek),
        owner_wrapped_sign_seed: serializeWrappedKey(ownerWrappedSignSeed),
        storage_mode: "knp-envelope",
      };

      await delivery.publishProtectedNote({
        kind: "note.publishProtected",
        slug: input.slug,
        placeId,
        objectId: noteId,
        burnMode: input.burnMode,
        saltB64: bytesToBase64(protectedKey.salt),
        meta,
        noteEnvelope,
      });

      const checkpoint: NoteCheckpoint = {
        noteId,
        epoch,
        version,
        stateHashB64: state.stateHashB64,
        policyHashB64: policy.policyHashB64,
      };
      saveCheckpoint(checkpoint);

      const session: NoteSession = {
        role: "owner",
        placeId,
        slug: input.slug,
        contentKey,
        ownerSignKey: ownerPair.privateKey,
        ownerPublicKey: ownerPair.publicKey,
        ownerId,
        epoch,
        version,
        policy,
        state,
        protectedMasterKey: protectedKey,
        ownerWrappedCek,
        ownerWrappedSignSeed,
        checkpoint,
      };
      return { session, workbook };
    },

    async unlockWithPassword(input: {
      readonly slug: string;
      readonly password: string;
    }): Promise<{ session: NoteSession; workbook: WorkbookPayload }> {
      const fetched = await delivery.fetchProtectedNote(input.slug);
      if (!fetched.exists) throw new Error("Note not found");

      const meta = fetched.meta;
      const protectedMasterKey = reviveProtectedMasterKey(meta.protected_master_key);
      const ownerWrappedCek = reviveWrappedKey(meta.owner_wrapped_cek);
      const masterKey = await security.passwords.unlockMasterKey({
        password: input.password,
        protectedKey: protectedMasterKey,
      });

      const masterBytes = await security.keys.exportSymmetricKey(masterKey);
      let ownerWrapKey: KeyHandle;
      try {
        ownerWrapKey = await security.keys.importSymmetricKey("wrapping", masterBytes);
      } finally {
        clearBytes(masterBytes);
      }

      const contentKey = await unwrapCek({
        wrappingKey: ownerWrapKey,
        wrapped: ownerWrappedCek,
        placeId: meta.state.header.placeId,
        noteId: meta.state.header.noteId,
        epoch: meta.epoch,
        capabilityId: ownerCapabilityId(meta.state.header.placeId),
        role: "owner",
        ownerId: meta.owner_id,
      });

      const ownerWrappedSignSeed = reviveWrappedKey(meta.owner_wrapped_sign_seed);
      const ownerSeedHandle = await unwrapCek({
        wrappingKey: ownerWrapKey,
        wrapped: ownerWrappedSignSeed,
        placeId: meta.state.header.placeId,
        noteId: meta.state.header.noteId,
        epoch: meta.epoch,
        capabilityId: `owner-sign:${meta.state.header.placeId}`,
        role: "owner",
        ownerId: meta.owner_id,
      });
      const ownerSeedBytes = await security.keys.exportSymmetricKey(ownerSeedHandle);
      let ownerSignKey: KeyHandle;
      let ownerPublicKey: PublicKeyBytes;
      try {
        const imported = await security.keys.importSigningSeed(ownerSeedBytes);
        ownerSignKey = imported.privateKey;
        ownerPublicKey = imported.publicKey;
      } finally {
        clearBytes(ownerSeedBytes);
      }

      const policyOk = await verifyPolicySignature(security, meta.policy.policy, ownerPublicKey);
      if (!policyOk) throw new Error("invalid owner policy signature");

      const stateOk = await verifyStateHeaderSignature(
        security,
        meta.state.header,
        ownerPublicKey,
      );
      if (!stateOk) throw new Error("invalid state signature");

      const noteEnvelope = base64ToBytes(meta.state.noteEnvelopeB64);
      const manifestEnvelope = base64ToBytes(meta.state.manifestEnvelopeB64);
      if ((await hashBytesB64(noteEnvelope)) !== meta.state.header.ciphertextHashB64) {
        throw new Error("ciphertext hash mismatch");
      }
      if ((await hashBytesB64(manifestEnvelope)) !== meta.state.header.manifestHashB64) {
        throw new Error("manifest hash mismatch");
      }

      const checkpoint = loadCheckpoint(meta.state.header.noteId);
      assertCheckpointAccepts({
        checkpoint,
        epoch: meta.epoch,
        version: meta.version,
        previousStateHashB64: meta.state.header.previousStateHashB64,
        stateHashB64: meta.state.stateHashB64,
      });

      const opened = await openWorkbookState({
        contentKey,
        placeId: meta.state.header.placeId,
        epoch: meta.epoch,
        version: meta.version,
        noteEnvelope,
        manifestEnvelope,
      });

      const nextCheckpoint: NoteCheckpoint = {
        noteId: meta.state.header.noteId,
        epoch: meta.epoch,
        version: meta.version,
        stateHashB64: meta.state.stateHashB64,
        policyHashB64: meta.policy.policyHashB64,
      };
      saveCheckpoint(nextCheckpoint);

      const session: NoteSession = {
        role: "owner",
        placeId: meta.state.header.placeId,
        slug: input.slug,
        contentKey,
        ownerSignKey,
        ownerPublicKey,
        ownerId: meta.owner_id,
        epoch: meta.epoch,
        version: meta.version,
        policy: meta.policy,
        state: meta.state,
        protectedMasterKey,
        ownerWrappedCek,
        ownerWrappedSignSeed,
        checkpoint: nextCheckpoint,
      };
      return { session, workbook: opened.workbook };
    },

    async saveState(input: {
      readonly session: NoteSession;
      readonly workbook: WorkbookPayload;
      readonly manifestDoc?: NoteAttachmentManifestDoc;
    }): Promise<NoteSession> {
      const { session } = input;
      const writerKey = session.ownerSignKey ?? session.editorSignKey;
      if (!writerKey) throw new Error("signing key required to save");
      if (session.role === "reader") throw new Error("readers cannot save");

      const newVersion = session.version + 1;
      const manifestDoc = input.manifestDoc ?? { v: 1 as const, files: [] };
      const { noteEnvelope, manifestEnvelope } = await encryptWorkbookState({
        contentKey: session.contentKey,
        placeId: session.placeId,
        epoch: session.epoch,
        version: newVersion,
        workbook: input.workbook,
        manifestDoc,
      });

      const state = await buildSignedState(security, {
        writerPrivateKey: writerKey,
        placeId: session.placeId,
        noteId: OBJECT_ID_WORKBOOK,
        accessEpoch: session.epoch,
        policyVersion: session.policy.policy.policyVersion,
        policyHashB64: session.policy.policyHashB64,
        version: newVersion,
        previousStateHashB64: session.state.stateHashB64,
        operation: "edit",
        writerKeyId:
          session.role === "owner" ? `owner:${session.ownerId}` : `editor:${writerKey.id}`,
        noteEnvelope,
        manifestEnvelope,
      });

      const meta: KnpPlaceMeta = {
        protocol: KNP_PROTOCOL,
        suite: KNP_SUITE,
        product_type: KNP_PRODUCT_ID,
        owner_public_key: bytesToBase64(session.ownerPublicKey.bytes),
        owner_id: session.ownerId,
        epoch: session.epoch,
        version: newVersion,
        policy: session.policy,
        state,
        protected_master_key: serializeProtectedMasterKey(session.protectedMasterKey),
        owner_wrapped_cek: serializeWrappedKey(session.ownerWrappedCek),
        owner_wrapped_sign_seed: serializeWrappedKey(session.ownerWrappedSignSeed),
        storage_mode: "knp-envelope",
      };

      const writerPub =
        session.role === "owner"
          ? session.ownerPublicKey
          : await security.keys.exportPublicKey(writerKey);

      await delivery.appendProtectedNote({
        kind: "note.appendProtected",
        slug: session.slug,
        placeId: session.placeId,
        expectedVersion: session.version,
        meta,
        noteEnvelope,
        writerPublicKeyB64: bytesToBase64(writerPub.bytes),
        stateSignatureB64: state.header.signatureB64,
      });

      const checkpoint: NoteCheckpoint = {
        noteId: OBJECT_ID_WORKBOOK,
        epoch: session.epoch,
        version: newVersion,
        stateHashB64: state.stateHashB64,
        policyHashB64: session.policy.policyHashB64,
      };
      saveCheckpoint(checkpoint);

      return { ...session, version: newVersion, state, checkpoint };
    },

    async issueReaderCapability(session: NoteSession): Promise<ReaderCapability> {
      const readerSecret = await security.keys.generateSymmetricKey("wrapping");
      const secretBytes = await security.keys.exportSymmetricKey(readerSecret);
      const capabilityId = crypto.randomUUID();
      try {
        const wrappedCek = await wrapCekUnderKey({
          wrappingKey: readerSecret,
          contentKey: session.contentKey,
          placeId: session.placeId,
          noteId: OBJECT_ID_WORKBOOK,
          epoch: session.epoch,
          capabilityId,
          role: "reader",
          ownerId: session.ownerId,
        });
        return {
          v: 1,
          protocol: KNP_PROTOCOL,
          placeId: session.placeId,
          noteId: OBJECT_ID_WORKBOOK,
          capabilityId,
          epoch: session.epoch,
          ownerId: session.ownerId,
          readerSecretB64: bytesToBase64(secretBytes),
          wrappedCek: {
            suite: wrappedCek.suite,
            nonce: wrappedCek.nonce,
            ciphertext: wrappedCek.ciphertext,
          },
          checkpoint: session.checkpoint ?? undefined,
        };
      } finally {
        clearBytes(secretBytes);
      }
    },

    async issueEditorCapability(session: NoteSession): Promise<{
      capability: EditorCapability;
      session: NoteSession;
    }> {
      if (session.role !== "owner" || !session.ownerSignKey) {
        throw new Error("only owner can issue editor capabilities");
      }
      const reader = await this.issueReaderCapability(session);
      const editorPair = await security.keys.generateSigningKey();
      const editorCapabilityId = crypto.randomUUID();
      const nextPolicyVersion = session.policy.policy.policyVersion + 1;
      const cert = await issueEditorCertificate(security, {
        ownerSignKey: session.ownerSignKey,
        noteId: OBJECT_ID_WORKBOOK,
        editorPublicKey: editorPair.publicKey,
        editorCapabilityId,
        accessEpoch: session.epoch,
        policyVersion: nextPolicyVersion,
      });
      const policy = await signPolicy(security, {
        ownerSignKey: session.ownerSignKey,
        noteId: OBJECT_ID_WORKBOOK,
        ownerId: session.ownerId,
        accessEpoch: session.epoch,
        policyVersion: nextPolicyVersion,
        previousPolicyHashB64: session.policy.policyHashB64,
        editorCertificates: [...session.policy.editorCertificates, cert],
      });

      const seedBytes = await security.keys.exportSigningSeed(editorPair.privateKey);
      const capability: EditorCapability = {
        ...reader,
        editorPrivateKeyB64: bytesToBase64(seedBytes),
        editorPublicKeyB64: bytesToBase64(editorPair.publicKey.bytes),
        editorCapabilityId,
      };
      clearBytes(seedBytes);

      return {
        capability,
        session: { ...session, policy },
      };
    },

    async unlockWithReaderCapability(input: {
      readonly slug: string;
      readonly capability: ReaderCapability;
    }): Promise<{ session: NoteSession; workbook: WorkbookPayload }> {
      const fetched = await delivery.fetchProtectedNote(input.slug);
      if (!fetched.exists) throw new Error("Note not found");
      const meta = fetched.meta;
      if (input.capability.ownerId !== meta.owner_id) {
        throw new Error("owner fingerprint mismatch");
      }
      if (input.capability.epoch !== meta.epoch) {
        throw new Error("capability epoch mismatch");
      }
      if (input.capability.checkpoint) {
        assertCheckpointAccepts({
          checkpoint: input.capability.checkpoint,
          epoch: meta.epoch,
          version: meta.version,
          previousStateHashB64: meta.state.header.previousStateHashB64,
          stateHashB64: meta.state.stateHashB64,
        });
      }

      const secretBytes = base64ToBytes(input.capability.readerSecretB64);
      let wrapKey: KeyHandle;
      try {
        wrapKey = await security.keys.importSymmetricKey("wrapping", secretBytes);
      } finally {
        clearBytes(secretBytes);
      }

      const wrapped = reviveWrappedKey(input.capability.wrappedCek);
      const contentKey = await unwrapCek({
        wrappingKey: wrapKey,
        wrapped,
        placeId: input.capability.placeId,
        noteId: input.capability.noteId,
        epoch: input.capability.epoch,
        capabilityId: input.capability.capabilityId,
        role: "reader",
        ownerId: input.capability.ownerId,
      });

      const ownerPublicKey: PublicKeyBytes = {
        suite: "KSC_V1",
        algorithm: "Ed25519",
        bytes: base64ToBytes(meta.owner_public_key),
      };
      const noteEnvelope = base64ToBytes(meta.state.noteEnvelopeB64);
      const manifestEnvelope = base64ToBytes(meta.state.manifestEnvelopeB64);
      const opened = await openWorkbookState({
        contentKey,
        placeId: meta.state.header.placeId,
        epoch: meta.epoch,
        version: meta.version,
        noteEnvelope,
        manifestEnvelope,
      });

      const session: NoteSession = {
        role: "reader",
        placeId: meta.state.header.placeId,
        slug: input.slug,
        contentKey,
        ownerPublicKey,
        ownerId: meta.owner_id,
        epoch: meta.epoch,
        version: meta.version,
        policy: meta.policy,
        state: meta.state,
        protectedMasterKey: reviveProtectedMasterKey(meta.protected_master_key),
        ownerWrappedCek: reviveWrappedKey(meta.owner_wrapped_cek),
        ownerWrappedSignSeed: reviveWrappedKey(meta.owner_wrapped_sign_seed),
        checkpoint: loadCheckpoint(meta.state.header.noteId),
      };
      return { session, workbook: opened.workbook };
    },

    async unlockWithEditorCapability(input: {
      readonly slug: string;
      readonly capability: EditorCapability;
    }): Promise<{ session: NoteSession; workbook: WorkbookPayload }> {
      const { session, workbook } = await this.unlockWithReaderCapability({
        slug: input.slug,
        capability: input.capability,
      });
      const seed = base64ToBytes(input.capability.editorPrivateKeyB64);
      let editorSignKey: KeyHandle;
      try {
        const imported = await security.keys.importSigningSeed(seed);
        editorSignKey = imported.privateKey;
      } finally {
        clearBytes(seed);
      }
      return {
        workbook,
        session: {
          ...session,
          role: "editor",
          editorSignKey,
        },
      };
    },

    async encryptAttachment(input: {
      readonly session: NoteSession;
      readonly attachmentId: string;
      readonly bytes: Uint8Array;
      readonly filename?: string;
      readonly mediaType?: string;
    }): Promise<{
      fileKey: KeyHandle;
      manifest: AttachmentTransportManifest;
      chunks: EncryptedChunk[];
    }> {
      const result = await security.files.encryptAttachment({
        source: bytesSource(input.bytes),
        binding: {
          productId: KNP_PRODUCT_ID,
          placeId: input.session.placeId,
          objectId: OBJECT_ID_WORKBOOK,
          attachmentId: input.attachmentId,
          protocolVersion: 1,
        },
        totalBytes: input.bytes.byteLength,
        chunkSize: 64 * 1024,
        metadata: {
          ...(input.filename !== undefined ? { filename: input.filename } : {}),
          ...(input.mediaType !== undefined ? { mediaType: input.mediaType } : {}),
        },
      });
      const chunks: EncryptedChunk[] = [];
      for await (const chunk of result.chunks) {
        chunks.push(chunk);
      }
      const manifest = await result.manifest;
      if (manifest.compression !== "none") {
        throw new Error("note attachments must not use compression");
      }
      return { fileKey: result.fileKey, manifest, chunks };
    },

    async decryptAttachment(input: {
      readonly session: NoteSession;
      readonly attachmentId: string;
      readonly fileKey: KeyHandle;
      readonly manifest: AttachmentTransportManifest;
      readonly chunks: readonly EncryptedChunk[];
    }): Promise<Uint8Array> {
      const result = await security.files.decryptAttachment({
        fileKey: input.fileKey,
        binding: {
          productId: KNP_PRODUCT_ID,
          placeId: input.session.placeId,
          objectId: OBJECT_ID_WORKBOOK,
          attachmentId: input.attachmentId,
          protocolVersion: 1,
        },
        manifest: input.manifest,
        chunks: (async function* () {
          for (const c of input.chunks) yield c;
        })(),
      });
      const parts: Uint8Array[] = [];
      let total = 0;
      for await (const part of result.plaintext) {
        parts.push(part);
        total += part.byteLength;
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
      }
      return out;
    },

    async changePassword(input: {
      readonly session: NoteSession;
      readonly oldPassword: string;
      readonly newPassword: string;
    }): Promise<NoteSession> {
      const { masterKey, protectedKey } = await security.passwords.changePassword({
        oldPassword: input.oldPassword,
        newPassword: input.newPassword,
        protectedKey: input.session.protectedMasterKey,
        params: TEST_ARGON2ID_PARAMS,
      });
      const masterBytes = await security.keys.exportSymmetricKey(masterKey);
      let ownerWrapKey: KeyHandle;
      try {
        ownerWrapKey = await security.keys.importSymmetricKey("wrapping", masterBytes);
      } finally {
        clearBytes(masterBytes);
      }
      const ownerWrappedCek = await wrapCekUnderKey({
        wrappingKey: ownerWrapKey,
        contentKey: input.session.contentKey,
        placeId: input.session.placeId,
        noteId: OBJECT_ID_WORKBOOK,
        epoch: input.session.epoch,
        capabilityId: ownerCapabilityId(input.session.placeId),
        role: "owner",
        ownerId: input.session.ownerId,
      });
      return {
        ...input.session,
        protectedMasterKey: protectedKey,
        ownerWrappedCek,
      };
    },
  };
}

export type NoteProtocol = ReturnType<typeof createNoteProtocol>;
