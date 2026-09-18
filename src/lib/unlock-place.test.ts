import { describe, expect, it } from "vitest";

import type { ExistingPage } from "@/lib/page-query";
import { isKnpUnlockCandidate, unlockPlace } from "@/lib/unlock-place";

function page(kdf_params: ExistingPage["kdf_params"]): ExistingPage {
  return {
    exists: true,
    id: "1",
    slug: "legacy",
    ciphertext: "",
    salt: "",
    iv: "",
    kdf_params,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    burn_mode: "never",
    expires_at: null,
  };
}

describe("unlockPlace", () => {
  it("treats public GET rows without kdf_params as KNP unlock candidates", () => {
    expect(isKnpUnlockCandidate(page({}))).toBe(true);
    expect(isKnpUnlockCandidate(page({ algo: "argon2id", m: 1, t: 1, p: 1, version: 1 }))).toBe(true);
    expect(isKnpUnlockCandidate(page({ protocol: "knp-1" }))).toBe(true);
  });

  it("rejects pages that name a different protocol", async () => {
    await expect(
      unlockPlace({ page: page({ protocol: "ksp-0" }), password: "x" }),
    ).rejects.toThrow(/not KNP-1/);
  });
});
