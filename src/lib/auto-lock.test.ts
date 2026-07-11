import { afterEach, describe, expect, it } from "vitest";

import {
  autoLockLabel,
  getAutoLockDuration,
  getAutoLockMs,
  setAutoLockDuration,
} from "@/lib/auto-lock";

describe("auto-lock", () => {
  afterEach(() => {
    localStorage.removeItem("kodama-auto-lock");
  });

  it("defaults to 15 minutes", () => {
    expect(getAutoLockDuration()).toBe("15m");
    expect(getAutoLockMs()).toBe(15 * 60 * 1000);
    expect(autoLockLabel("15m")).toBe("15 minutes");
  });

  it("persists never", () => {
    setAutoLockDuration("never");
    expect(getAutoLockDuration()).toBe("never");
    expect(getAutoLockMs()).toBeNull();
  });

  it("persists 5 minutes", () => {
    setAutoLockDuration("5m");
    expect(getAutoLockMs()).toBe(5 * 60 * 1000);
  });
});
