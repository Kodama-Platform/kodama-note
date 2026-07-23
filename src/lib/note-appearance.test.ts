import { afterEach, describe, expect, it } from "vitest";

import {
  getStoredNoteAppearance,
  isHexColor,
  resolveNoteColors,
  setStoredNoteAppearance,
} from "@/lib/note-appearance";

describe("note-appearance", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("validates hex colors", () => {
    expect(isHexColor("#C9C3B6")).toBe(true);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("white")).toBe(false);
  });

  it("resolves dusk with soft (non-white) text", () => {
    const colors = resolveNoteColors({ preset: "dusk" }, "dark");
    expect(colors.text.toLowerCase()).not.toBe("#ffffff");
    expect(colors.text.toLowerCase()).not.toBe("#fff");
    expect(colors.background).toBe("#1C1E1A");
  });

  it("default dark text is softer than pure white", () => {
    const colors = resolveNoteColors({ preset: "default" }, "dark");
    expect(colors.text.toLowerCase()).toBe("#c9c3b6");
  });

  it("persists custom appearance", () => {
    setStoredNoteAppearance({
      preset: "custom",
      background: "#112211",
      text: "#CCDDBB",
    });
    expect(getStoredNoteAppearance()).toEqual({
      preset: "custom",
      background: "#112211",
      text: "#CCDDBB",
    });
  });

  it("resolves custom colors", () => {
    const colors = resolveNoteColors(
      { preset: "custom", background: "#112211", text: "#CCDDBB" },
      "dark",
    );
    expect(colors.background).toBe("#112211");
    expect(colors.text).toBe("#CCDDBB");
  });
});
