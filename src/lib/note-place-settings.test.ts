import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_NOTE_PLACE_SETTINGS,
  appearanceFromSettings,
  parseNotePlaceSettings,
  placeSettingsToCssVars,
  settingsWithAppearance,
} from "@/lib/note-place-settings";

describe("note-place-settings", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("parses a valid document and clamps ranges", () => {
    const parsed = parseNotePlaceSettings({
      schema: "knp-place-settings-1",
      preset: "custom",
      background: "#F3EFE6",
      text: "#3A3730",
      font: "mono",
      font_size: 115,
      line_height: 3,
      letter_spacing: 1,
      paragraph_spacing: "relaxed",
      view_width: "full",
    });
    expect(parsed).toMatchObject({
      preset: "custom",
      font: "mono",
      font_size: 115,
      line_height: 2.2,
      letter_spacing: 0.08,
      paragraph_spacing: "relaxed",
      view_width: "full",
      background: "#F3EFE6",
      text: "#3A3730",
    });
  });

  it("falls back to defaults for junk", () => {
    const parsed = parseNotePlaceSettings({ preset: "neon", font_size: 12 });
    expect(parsed?.preset).toBe("default");
    expect(parsed?.font_size).toBe(DEFAULT_NOTE_PLACE_SETTINGS.font_size);
  });

  it("maps appearance in and out", () => {
    const settings = settingsWithAppearance(DEFAULT_NOTE_PLACE_SETTINGS, {
      preset: "dusk",
    });
    expect(appearanceFromSettings(settings).preset).toBe("dusk");
  });

  it("emits CSS variables", () => {
    const vars = placeSettingsToCssVars({
      ...DEFAULT_NOTE_PLACE_SETTINGS,
      font: "sans",
      line_height: 1.4,
      letter_spacing: 0.02,
      paragraph_spacing: "tight",
    });
    expect(vars["--note-font-family"]).toBe("var(--font-sans)");
    expect(vars["--note-line-height"]).toBe("1.4");
    expect(vars["--note-letter-spacing"]).toBe("0.02");
    expect(vars["--note-paragraph-spacing"]).toBe("0.4em");
  });
});
