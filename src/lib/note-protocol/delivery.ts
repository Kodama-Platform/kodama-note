import type { NotePolicyBundle } from "./policy";
import type { SignedState } from "./state";

/** Public place metadata stored by the Delivery Gate (no secrets). */
export type KnpPlaceMeta = {
  readonly protocol: "knp-1";
  readonly suite: "KSC_V1";
  readonly product_type: "note";
  readonly owner_public_key: string;
  readonly owner_id: string;
  readonly epoch: number;
  readonly version: number;
  readonly policy: NotePolicyBundle;
  readonly state: SignedState;
  /** PasswordProtectedMasterKey JSON (public wrap record — not the password). */
  readonly protected_master_key: unknown;
  /** Owner-wrapped CEK (WrappedKey JSON). */
  readonly owner_wrapped_cek: unknown;
  /** Owner-wrapped Ed25519 seed (WrappedKey over 32-byte seed). */
  readonly owner_wrapped_sign_seed: unknown;
  readonly storage_mode: "knp-envelope";
};

export type PublishProtectedNoteCommand = {
  readonly kind: "note.publishProtected";
  readonly slug: string;
  readonly placeId: string;
  readonly objectId: string;
  readonly burnMode: string;
  readonly saltB64: string;
  readonly meta: KnpPlaceMeta;
  /** Note envelope bytes only. */
  readonly noteEnvelope: Uint8Array;
  /** Ed25519 over CBOR { document, purpose: knp-place-create-1, slug }. */
  readonly gateSignatureB64: string;
};

export type AppendProtectedNoteCommand = {
  readonly kind: "note.appendProtected";
  readonly slug: string;
  readonly placeId: string;
  readonly expectedVersion: number;
  readonly meta: KnpPlaceMeta;
  readonly noteEnvelope: Uint8Array;
  readonly saltB64: string;
  readonly writerPublicKeyB64: string;
  /** KNP state-header signature (inside kdf_params — not the Gate sig). */
  readonly stateSignatureB64: string;
  /** Ed25519 over CBOR { document, purpose: knp-private-tabs-put-1, slug }. */
  readonly gateSignatureB64: string;
};

export type PublishAttachmentCommand = {
  readonly kind: "note.publishAttachment";
  readonly slug: string;
  readonly storagePath: string;
  readonly iv: string;
  readonly filenameCiphertext: string;
  readonly filenameIv: string;
  readonly mime: string;
  readonly size: number;
};

export type DeleteAttachmentCommand = {
  readonly kind: "note.deleteAttachment";
  readonly slug: string;
  readonly attachmentId: string;
};

export type UpdateExpiryCommand = {
  readonly kind: "note.updateExpiry";
  readonly slug: string;
  readonly burnMode: string;
};

export interface NoteDeliveryClient {
  publishProtectedNote(command: PublishProtectedNoteCommand): Promise<{ expires_at: string | null }>;
  appendProtectedNote(command: AppendProtectedNoteCommand): Promise<void>;
  fetchProtectedNote(slug: string): Promise<
    | {
        exists: false;
      }
    | {
        exists: true;
        slug: string;
        noteEnvelope: Uint8Array;
        saltB64: string;
        meta: KnpPlaceMeta;
        burnMode: string;
        expiresAt: string | null;
        updatedAt: string;
      }
  >;
  publishEncryptedAttachment(
    command: PublishAttachmentCommand,
  ): Promise<{ id: string; created_at: string }>;
  deleteEncryptedAttachment(command: DeleteAttachmentCommand): Promise<void>;
  updateExpiry(
    command: UpdateExpiryCommand,
  ): Promise<{ burn_mode: string; expires_at: string | null }>;
}
