import { describe, expect, it } from "vitest";

import {
  lockedBadgeLabel,
  lockedDescription,
  resolveUnlockCapability,
} from "@/lib/unlock-capability";

describe("unlock-capability", () => {
  it("prefers editor when secrets or password unlock present", () => {
    expect(resolveUnlockCapability({ hasEditorSecrets: true })).toBe("editor");
    expect(resolveUnlockCapability({ unlockedWithPassword: true })).toBe("editor");
  });

  it("detects reader share links", () => {
    expect(resolveUnlockCapability({ hasReadCapability: true })).toBe("reader");
  });

  it("defaults to owner", () => {
    expect(resolveUnlockCapability({})).toBe("owner");
  });

  it("describes each capability", () => {
    expect(lockedBadgeLabel("editor")).toContain("edit");
    expect(lockedDescription("reader")).toMatch(/reading|read/i);
    expect(lockedDescription("owner")).toContain("password");
  });
});
