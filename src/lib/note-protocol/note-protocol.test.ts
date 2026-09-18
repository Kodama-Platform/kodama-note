import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBrowserSecurityProvider } from "@kodama.page/security-browser";

import { createEmptyWorkbook } from "@/lib/workbook";
import { assertCheckpointAccepts, clearCheckpoint, type NoteCheckpoint } from "./checkpoint";
import type { KnpPlaceMeta, NoteDeliveryClient } from "./delivery";
import { createNoteProtocol } from "./note-protocol";
import { encodeWrapAad } from "./wrap-aad";

function memoryDelivery(): NoteDeliveryClient & {
  store: Map<string, { envelope: Uint8Array; meta: KnpPlaceMeta; saltB64: string }>;
} {
  const store = new Map<string, { envelope: Uint8Array; meta: KnpPlaceMeta; saltB64: string }>();
  return {
    store,
    async publishProtectedNote(command) {
      if (store.has(command.slug)) throw new Error("slug_taken");
      store.set(command.slug, {
        envelope: command.noteEnvelope,
        meta: command.meta,
        saltB64: command.saltB64,
      });
      return { expires_at: null };
    },
    async appendProtectedNote(command) {
      const cur = store.get(command.slug);
      if (!cur) throw new Error("missing");
      if (cur.meta.version !== command.expectedVersion) throw new Error("stale");
      store.set(command.slug, {
        envelope: command.noteEnvelope,
        meta: command.meta,
        saltB64: cur.saltB64,
      });
    },
    async fetchProtectedNote(slug) {
      const row = store.get(slug);
      if (!row) return { exists: false as const };
      return {
        exists: true as const,
        slug,
        noteEnvelope: row.envelope,
        saltB64: row.saltB64,
        meta: row.meta,
        burnMode: "never",
        expiresAt: null,
        updatedAt: new Date().toISOString(),
      };
    },
    async publishEncryptedAttachment() {
      return { id: crypto.randomUUID(), created_at: new Date().toISOString() };
    },
    async deleteEncryptedAttachment() {},
    async updateExpiry() {
      return { burn_mode: "never", expires_at: null };
    },
  };
}

describe("KNP-1 note protocol", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("encodes wrap AAD with protocol fields", () => {
    const aad = encodeWrapAad({
      placeId: "p1",
      noteId: "workbook",
      epoch: 0,
      capabilityId: "cap",
      role: "owner",
      ownerId: "oid",
    });
    expect(aad.byteLength).toBeGreaterThan(8);
  });

  it("rejects checkpoint rollback", () => {
    const checkpoint: NoteCheckpoint = {
      noteId: "workbook",
      epoch: 0,
      version: 2,
      stateHashB64: "abc",
      policyHashB64: "pol",
    };
    expect(() =>
      assertCheckpointAccepts({
        checkpoint,
        epoch: 0,
        version: 1,
        previousStateHashB64: null,
        stateHashB64: "x",
      }),
    ).toThrow(/version older/);
  });

  it("create → save → password unlock → reader open", async () => {
    const security = createBrowserSecurityProvider();
    const delivery = memoryDelivery();
    const note = createNoteProtocol({ security, delivery });
    const slug = `note-${crypto.randomUUID().slice(0, 8)}`;

    const created = await note.createPlace({
      slug,
      password: "test-password-ok",
      burnMode: "never",
      workbook: createEmptyWorkbook(),
    });
    expect(created.session.role).toBe("owner");
    expect(created.session.version).toBe(0);

    const workbook = createEmptyWorkbook();
    workbook.sheets[0]!.markdown = "hello knp";
    const savedSession = await note.saveState({
      session: created.session,
      workbook,
    });
    expect(savedSession.version).toBe(1);

    clearCheckpoint("workbook");
    const unlocked = await note.unlockWithPassword({
      slug,
      password: "test-password-ok",
    });
    expect(unlocked.session.role).toBe("owner");
    expect(unlocked.workbook.sheets[0]!.markdown).toBe("hello knp");

    const readerCap = await note.issueReaderCapability(unlocked.session);
    clearCheckpoint("workbook");
    const asReader = await note.unlockWithReaderCapability({
      slug,
      capability: readerCap,
    });
    expect(asReader.session.role).toBe("reader");
    expect(asReader.workbook.sheets[0]!.markdown).toBe("hello knp");
    await expect(
      note.saveState({ session: asReader.session, workbook }),
    ).rejects.toThrow(/cannot save|signing key/i);
  }, 60_000);

  it("rejects wrong password", async () => {
    const security = createBrowserSecurityProvider();
    const delivery = memoryDelivery();
    const note = createNoteProtocol({ security, delivery });
    const slug = `note-${crypto.randomUUID().slice(0, 8)}`;
    await note.createPlace({
      slug,
      password: "correct-horse",
      burnMode: "never",
    });
    await expect(
      note.unlockWithPassword({ slug, password: "wrong-password" }),
    ).rejects.toThrow();
  }, 60_000);

  it("editor unlock requires an active certificate", async () => {
    const security = createBrowserSecurityProvider();
    const delivery = memoryDelivery();
    const note = createNoteProtocol({ security, delivery });
    const slug = `note-${crypto.randomUUID().slice(0, 8)}`;
    const created = await note.createPlace({
      slug,
      password: "test-password-ok",
      burnMode: "never",
    });
    const issued = await note.issueEditorCapability(created.session);
    await note.saveState({
      session: issued.session,
      workbook: created.workbook,
    });
    clearCheckpoint("workbook");
    const asEditor = await note.unlockWithEditorCapability({
      slug,
      capability: issued.capability,
    });
    expect(asEditor.session.role).toBe("editor");
  }, 60_000);

  it("persists password change so the new password unlocks", async () => {
    const security = createBrowserSecurityProvider();
    const delivery = memoryDelivery();
    const note = createNoteProtocol({ security, delivery });
    const slug = `note-${crypto.randomUUID().slice(0, 8)}`;
    const created = await note.createPlace({
      slug,
      password: "old-password-ok",
      burnMode: "never",
    });
    await note.changePassword({
      session: created.session,
      oldPassword: "old-password-ok",
      newPassword: "new-password-ok",
    });
    clearCheckpoint("workbook");
    const unlocked = await note.unlockWithPassword({
      slug,
      password: "new-password-ok",
    });
    expect(unlocked.session.role).toBe("owner");
  }, 60_000);
});
