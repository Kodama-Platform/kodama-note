/** Per-device note writing surface colors — independent of chrome theme. */

export type NoteAppearancePreset =
  | "default"
  | "paper"
  | "ink"
  | "sepia"
  | "dusk"
  | "moss"
  | "custom";

export type NoteAppearance = {
  preset: NoteAppearancePreset;
  /** Custom background hex (`#rrggbb`). Used when preset is `custom`. */
  background?: string;
  /** Custom text hex (`#rrggbb`). Used when preset is `custom`. */
  text?: string;
};

export type ResolvedNoteColors = {
  background: string;
  text: string;
  muted: string;
};

const STORAGE_KEY = "kodama-note-appearance";

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isHexColor(value: string | undefined): value is string {
  return typeof value === "string" && HEX.test(value);
}

/** Soft pairs — dark presets avoid pure white text. */
export const NOTE_APPEARANCE_PRESETS: Record<
  Exclude<NoteAppearancePreset, "custom">,
  {
    label: string;
    hint: string;
    light: ResolvedNoteColors;
    dark: ResolvedNoteColors;
  }
> = {
  default: {
    label: "Default",
    hint: "Follows app theme, soft contrast",
    light: {
      background: "transparent",
      text: "#3A3730",
      muted: "#7A756B",
    },
    dark: {
      background: "transparent",
      // Warm stone — not pure white
      text: "#C9C3B6",
      muted: "#8A8478",
    },
  },
  paper: {
    label: "Paper",
    hint: "Warm cream page",
    light: { background: "#F3EFE6", text: "#3A3730", muted: "#7A756B" },
    dark: { background: "#F3EFE6", text: "#3A3730", muted: "#7A756B" },
  },
  ink: {
    label: "Ink",
    hint: "Soft charcoal on mist",
    light: { background: "#F7F6F3", text: "#2C2A26", muted: "#6E6A62" },
    dark: { background: "#F7F6F3", text: "#2C2A26", muted: "#6E6A62" },
  },
  sepia: {
    label: "Sepia",
    hint: "Classic reading tone",
    light: { background: "#F0E6D2", text: "#4A3B28", muted: "#8A7358" },
    dark: { background: "#F0E6D2", text: "#4A3B28", muted: "#8A7358" },
  },
  dusk: {
    label: "Dusk",
    hint: "Dim forest night",
    light: { background: "#1C1E1A", text: "#C4BDB0", muted: "#8A8478" },
    dark: { background: "#1C1E1A", text: "#C4BDB0", muted: "#8A8478" },
  },
  moss: {
    label: "Moss",
    hint: "Deep green page",
    light: { background: "#1A2218", text: "#C2CBB8", muted: "#7F8A72" },
    dark: { background: "#1A2218", text: "#C2CBB8", muted: "#7F8A72" },
  },
};

function mixMuted(textHex: string): string {
  // Approximate a muted tone toward mid-gray for custom text.
  const r = parseInt(textHex.slice(1, 3), 16);
  const g = parseInt(textHex.slice(3, 5), 16);
  const b = parseInt(textHex.slice(5, 7), 16);
  const mr = Math.round(r * 0.55 + 128 * 0.45);
  const mg = Math.round(g * 0.55 + 128 * 0.45);
  const mb = Math.round(b * 0.55 + 128 * 0.45);
  return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`;
}

export function getStoredNoteAppearance(): NoteAppearance {
  if (typeof window === "undefined") return { preset: "default" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { preset: "default" };
    const parsed = JSON.parse(raw) as Partial<NoteAppearance>;
    const preset = parsed.preset;
    if (
      preset !== "default" &&
      preset !== "paper" &&
      preset !== "ink" &&
      preset !== "sepia" &&
      preset !== "dusk" &&
      preset !== "moss" &&
      preset !== "custom"
    ) {
      return { preset: "default" };
    }
    return {
      preset,
      background: isHexColor(parsed.background) ? parsed.background : undefined,
      text: isHexColor(parsed.text) ? parsed.text : undefined,
    };
  } catch {
    return { preset: "default" };
  }
}

export function setStoredNoteAppearance(appearance: NoteAppearance): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveNoteColors(
  appearance: NoteAppearance,
  theme: "light" | "dark",
): ResolvedNoteColors {
  if (appearance.preset === "custom") {
    const background = isHexColor(appearance.background)
      ? appearance.background
      : theme === "dark"
        ? "#1C1E1A"
        : "#F7F6F3";
    const text = isHexColor(appearance.text)
      ? appearance.text
      : theme === "dark"
        ? "#C9C3B6"
        : "#3A3730";
    return { background, text, muted: mixMuted(text) };
  }

  const preset = NOTE_APPEARANCE_PRESETS[appearance.preset] ?? NOTE_APPEARANCE_PRESETS.default;
  return theme === "dark" ? preset.dark : preset.light;
}

/** CSS custom properties for the writing surface. */
export function noteColorsToCssVars(colors: ResolvedNoteColors): Record<string, string> {
  return {
    "--note-bg": colors.background,
    "--note-fg": colors.text,
    "--note-muted": colors.muted,
  };
}
