/** Public per-slug presentation (Delivery Gate). Not encrypted. */

import { isHexColor, type NoteAppearance, type NoteAppearancePreset } from "@/lib/note-appearance";
import {
  EDITOR_FONT_SCALE_STEPS,
  getEditorFontScale,
  getEditorViewWidth,
  type EditorFontScale,
  type EditorViewWidth,
} from "@/lib/editor-view-prefs";

export const NOTE_PLACE_SETTINGS_SCHEMA = "knp-place-settings-1" as const;

export type NotePlaceFont = "sans" | "serif" | "mono";
export type NoteParagraphSpacing = "tight" | "normal" | "relaxed";

export type NotePlaceSettings = {
  schema: typeof NOTE_PLACE_SETTINGS_SCHEMA;
  preset: NoteAppearancePreset;
  background?: string;
  text?: string;
  font: NotePlaceFont;
  font_family: string | null;
  font_size: EditorFontScale;
  line_height: number;
  letter_spacing: number;
  paragraph_spacing: NoteParagraphSpacing;
  view_width: EditorViewWidth;
};

export const DEFAULT_NOTE_PLACE_SETTINGS: NotePlaceSettings = {
  schema: NOTE_PLACE_SETTINGS_SCHEMA,
  preset: "default",
  font: "serif",
  font_family: null,
  font_size: 100,
  line_height: 1.65,
  letter_spacing: 0,
  paragraph_spacing: "normal",
  view_width: "comfortable",
};

const PRESETS: NoteAppearancePreset[] = [
  "default",
  "paper",
  "ink",
  "sepia",
  "dusk",
  "moss",
  "custom",
];

const FONTS: NotePlaceFont[] = ["sans", "serif", "mono"];
const PARAGRAPH: NoteParagraphSpacing[] = ["tight", "normal", "relaxed"];
const WIDTHS: EditorViewWidth[] = ["comfortable", "tablet", "full"];

const PARAGRAPH_MARGIN: Record<NoteParagraphSpacing, string> = {
  tight: "0.4em",
  normal: "0.75em",
  relaxed: "1.15em",
};

const FONT_CSS: Record<NotePlaceFont, string> = {
  sans: "var(--font-sans)",
  serif: "var(--font-serif)",
  mono: "var(--font-mono)",
};

function isPreset(value: unknown): value is NoteAppearancePreset {
  return typeof value === "string" && (PRESETS as string[]).includes(value);
}

function isFont(value: unknown): value is NotePlaceFont {
  return typeof value === "string" && (FONTS as string[]).includes(value);
}

function isFontSize(value: unknown): value is EditorFontScale {
  return typeof value === "number" && (EDITOR_FONT_SCALE_STEPS as readonly number[]).includes(value);
}

function isParagraph(value: unknown): value is NoteParagraphSpacing {
  return typeof value === "string" && (PARAGRAPH as string[]).includes(value);
}

function isWidth(value: unknown): value is EditorViewWidth {
  return typeof value === "string" && (WIDTHS as string[]).includes(value);
}

function clampLineHeight(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_NOTE_PLACE_SETTINGS.line_height;
  return Math.min(2.2, Math.max(1.2, Math.round(n * 100) / 100));
}

function clampLetterSpacing(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(0.08, Math.max(-0.04, Math.round(n * 1000) / 1000));
}

export function parseNotePlaceSettings(raw: unknown): NotePlaceSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const preset = isPreset(row.preset) ? row.preset : DEFAULT_NOTE_PLACE_SETTINGS.preset;
  const font = isFont(row.font) ? row.font : DEFAULT_NOTE_PLACE_SETTINGS.font;
  const fontSizeRaw = typeof row.font_size === "string" ? Number(row.font_size) : row.font_size;
  const settings: NotePlaceSettings = {
    schema: NOTE_PLACE_SETTINGS_SCHEMA,
    preset,
    font,
    font_family: typeof row.font_family === "string" && row.font_family.trim() ? row.font_family.trim() : null,
    font_size: isFontSize(fontSizeRaw) ? fontSizeRaw : DEFAULT_NOTE_PLACE_SETTINGS.font_size,
    line_height: clampLineHeight(row.line_height),
    letter_spacing: clampLetterSpacing(row.letter_spacing),
    paragraph_spacing: isParagraph(row.paragraph_spacing)
      ? row.paragraph_spacing
      : DEFAULT_NOTE_PLACE_SETTINGS.paragraph_spacing,
    view_width: isWidth(row.view_width) ? row.view_width : DEFAULT_NOTE_PLACE_SETTINGS.view_width,
  };
  if (isHexColor(typeof row.background === "string" ? row.background : undefined)) {
    settings.background = row.background as string;
  }
  if (isHexColor(typeof row.text === "string" ? row.text : undefined)) {
    settings.text = row.text as string;
  }
  return settings;
}

export function normalizeNotePlaceSettings(settings: NotePlaceSettings): NotePlaceSettings {
  return parseNotePlaceSettings(settings) ?? DEFAULT_NOTE_PLACE_SETTINGS;
}

export function appearanceFromSettings(settings: NotePlaceSettings): NoteAppearance {
  return {
    preset: settings.preset,
    background: settings.background,
    text: settings.text,
  };
}

export function settingsWithAppearance(
  settings: NotePlaceSettings,
  appearance: NoteAppearance,
): NotePlaceSettings {
  return normalizeNotePlaceSettings({
    ...settings,
    preset: appearance.preset,
    background: appearance.background,
    text: appearance.text,
  });
}

export function placeSettingsFromDevice(): NotePlaceSettings {
  return normalizeNotePlaceSettings({
    ...DEFAULT_NOTE_PLACE_SETTINGS,
    font_size: getEditorFontScale(),
    view_width: getEditorViewWidth(),
  });
}

export function placeSettingsToCssVars(settings: NotePlaceSettings): Record<string, string> {
  const family = settings.font_family?.trim() || FONT_CSS[settings.font];
  return {
    "--note-font-family": family,
    "--note-line-height": String(settings.line_height),
    "--note-letter-spacing": String(settings.letter_spacing),
    "--note-paragraph-spacing": PARAGRAPH_MARGIN[settings.paragraph_spacing],
  };
}

const CACHE_PREFIX = "kodama-place-settings:";

export function cachePlaceSettings(slug: string, settings: NotePlaceSettings): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify(normalizeNotePlaceSettings(settings)));
  } catch {
    /* ignore */
  }
}

export function readCachedPlaceSettings(slug: string): NotePlaceSettings | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${slug}`);
    return raw ? parseNotePlaceSettings(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function resolveInitialPlaceSettings(
  slug: string,
  fromPage?: NotePlaceSettings | null,
): NotePlaceSettings {
  if (fromPage) return normalizeNotePlaceSettings(fromPage);
  return readCachedPlaceSettings(slug) ?? placeSettingsFromDevice();
}
