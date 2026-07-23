/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  createKspWorkbookPlace,
  decryptKspWorkbook,
  isKspPlaceMeta,
  saveKspWorkbookEdit,
  WORKBOOK_NOTE_ID,
} from "@/lib/ksp-place";
import { kspSessionFromSecrets } from "@/lib/crypto-context";
import { resolveShareCapabilities } from "@/lib/share-capabilities";
import { parseKspWire } from "@/lib/ksp-wire";
import { base64ToBytes } from "@kodama.page/ksp-core";

describe("ksp-place bundle flow", () => {
  it("recognizes KSP metadata stored as a JSON string", () => {
    const meta = {
      protocol: "ksp-v1",
      owner_public_key: "owner-pub",
    };
    expect(isKspPlaceMeta(JSON.stringify(meta))).toBe(true);
  });

  it("exposes share capabilities after create", async () => {
    const created = await createKspWorkbookPlace({
      slug: "share-test",
      password: "secret-password",
      workbookPlaintext: '{"sheets":[]}',
    });
    const crypto = kspSessionFromSecrets({
      slug: "share-test",
      secrets: {
        readerCapability: created.readerCapability,
        editorPrivateKey: created.editorPrivateKey,
        ownerPrivateKey: created.ownerPrivateKey,
      },
      meta: created.kdf_params,
    });
    const caps = resolveShareCapabilities({
      session: crypto,
      stored: null,
      readFromUrl: null,
    });
    expect(caps.readerCapability).toBeTruthy();
    expect(caps.editorPrivateKey).toBeTruthy();
  });

  it("creates, edits, and decrypts a workbook bundle", async () => {
    const created = await createKspWorkbookPlace({
      slug: "test-place",
      password: "secret-password",
      workbookPlaintext: '{"sheets":[]}',
    });

    expect(parseKspWire(created.ciphertext)?.storage_mode).toBe("bundle");
    expect(created.kdf_params.storage_mode).toBe("bundle");
    expect(created.kdf_params.version).toBe(1);
    expect(created.kdf_params.editor_public_keys.length).toBeGreaterThan(0);

    const readKey = base64ToBytes(created.readerCapability);
    const decrypted = await decryptKspWorkbook({
      page: {
        slug: "test-place",
        ciphertext: created.ciphertext,
        iv: created.iv,
        salt: created.salt,
        kdf_params: created.kdf_params,
      } as never,
      readKey,
    });
    expect(decrypted).toBe('{"sheets":[]}');

    const edited = await saveKspWorkbookEdit({
      slug: "test-place",
      workbookPlaintext: '{"sheets":[{"sheet_id":"a"}]}',
      readKey,
      editorPrivateKey: created.editorPrivateKey,
      editorPublicKey: created.kdf_params.editor_public_keys[0]!,
      oldVersion: 1,
      productType: "note",
    });
    expect(edited.newVersion).toBe(2);

    const wire = parseKspWire(edited.wireCiphertext);
    expect(wire?.version).toBe(2);
    expect(wire?.edit?.new_version).toBe(2);
    expect(wire?.bundle?.notes[0]?.id).toBe(WORKBOOK_NOTE_ID);

    const afterEdit = await decryptKspWorkbook({
      page: {
        slug: "test-place",
        ciphertext: edited.wireCiphertext,
        iv: edited.iv,
        salt: created.salt,
        kdf_params: { ...created.kdf_params, version: 2 },
      } as never,
      readKey,
    });
    expect(afterEdit).toBe('{"sheets":[{"sheet_id":"a"}]}');
  });
});
