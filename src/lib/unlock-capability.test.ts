import { describe, expect, it } from "vitest";

import {
  lockedBadgeLabel,
  lockedDescription,
  resolveUnlockCapability,
} from "@/lib/unlock-capability";

describe("unlock-capability", () => {
  it("prefers editor when edit token is present", () => {
    expect(resolveUnlockCapability("token", false)).toBe("editor");
    expect(resolveUnlockCapability("token", true)).toBe("editor");
  });

  it("detects reader share links", () => {
    expect(resolveUnlockCapability(null, true)).toBe("reader");
  });

  it("defaults to owner", () => {
    expect(resolveUnlockCapability(null, false)).toBe("owner");
  });

  it("describes each capability", () => {
    expect(lockedBadgeLabel("editor")).toContain("editable");
    expect(lockedDescription("reader")).toContain("share link");
    expect(lockedDescription("owner")).toContain("password");
  });
});
