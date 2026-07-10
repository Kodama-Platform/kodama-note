import { afterEach, describe, expect, it } from "vitest";

import { getSaveMode, setSaveMode } from "@/lib/save-mode";

describe("save-mode", () => {
  afterEach(() => {
    localStorage.removeItem("kodama-save-mode");
  });

  it("defaults to auto", () => {
    expect(getSaveMode()).toBe("auto");
  });

  it("persists manual mode", () => {
    setSaveMode("manual");
    expect(getSaveMode()).toBe("manual");
  });
});
