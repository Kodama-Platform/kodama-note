/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import { resolveMigrateToKspGate } from "@/lib/migrate-to-ksp";
import { assertKspEditorPublicKeys, createKspWorkbookPlace } from "@/lib/ksp-place";

describe("resolveMigrateToKspGate", () => {
  it("hides for KSP sessions and readers", () => {
    expect(
      resolveMigrateToKspGate({
        isLegacy: false,
        isReader: false,
        hasEditToken: true,
        hasAttachments: false,
      }).status,
    ).toBe("hidden");
    expect(
      resolveMigrateToKspGate({
        isLegacy: true,
        isReader: true,
        hasEditToken: true,
        hasAttachments: false,
      }).status,
    ).toBe("hidden");
  });

  it("blocks when attachments exist", () => {
    expect(
      resolveMigrateToKspGate({
        isLegacy: true,
        isReader: false,
        hasEditToken: true,
        hasAttachments: true,
      }).status,
    ).toBe("blocked_attachments");
  });

  it("blocks when edit token is missing", () => {
    expect(
      resolveMigrateToKspGate({
        isLegacy: true,
        isReader: false,
        hasEditToken: false,
        hasAttachments: false,
      }).status,
    ).toBe("blocked_no_token");
  });

  it("is ready when legacy editor has token and no attachments", () => {
    expect(
      resolveMigrateToKspGate({
        isLegacy: true,
        isReader: false,
        hasEditToken: true,
        hasAttachments: false,
      }).status,
    ).toBe("ready");
  });
});

describe("KSP editor public keys", () => {
  it("createKspWorkbookPlace persists non-empty editor_public_keys", async () => {
    const created = await createKspWorkbookPlace({
      slug: "editor-keys-place",
      password: "secret-password",
      workbookPlaintext: '{"sheets":[]}',
    });
    expect(created.kdf_params.editor_public_keys.length).toBeGreaterThan(0);
    expect(() => assertKspEditorPublicKeys(created.kdf_params)).not.toThrow();
  });

  it("assertKspEditorPublicKeys rejects empty lists", () => {
    expect(() => assertKspEditorPublicKeys({ editor_public_keys: [] })).toThrow(
      /editor_public_keys required/,
    );
    expect(() =>
      assertKspEditorPublicKeys({ editor_public_keys: undefined as unknown as string[] }),
    ).toThrow(/editor_public_keys required/);
  });
});
