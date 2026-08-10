import type { CSSProperties } from "react";

/**
 * Visual tokens for `@kodama.page/editor`.
 * All fields optional — omitted values inherit host CSS / package defaults.
 */
export type KodamaEditorTheme = {
  /** Adds `.dark` on the editor root so package dark selectors apply locally. */
  readonly mode?: "light" | "dark";
  /** Body / paragraph font stack. */
  readonly fontFamily?: string;
  /** Heading font stack. */
  readonly headingFontFamily?: string;
  /** Code / mono font stack. */
  readonly monoFontFamily?: string;
  /** Base body size — number = px, or any CSS length (`1.05rem`). */
  readonly fontSize?: number | string;
  /** Writing surface background. */
  readonly backgroundColor?: string;
  /** Primary text / caret. */
  readonly textColor?: string;
  /** Muted text (quotes, placeholders, task done). */
  readonly mutedColor?: string;
  /** `==highlight==` / `<mark>` background. */
  readonly highlightColor?: string;
  /** Text selection wash. */
  readonly selectionColor?: string;
  /** Accent (links, pressed toolbar, checkboxes). */
  readonly primaryColor?: string;
  /** Borders (toolbar, tables, hr). */
  readonly borderColor?: string;
  /** Floating chrome surface (toolbar / slash menu). */
  readonly surfaceColor?: string;
  /** Escape hatch — merged last onto the editor root. */
  readonly cssVariables?: Readonly<Record<string, string>>;
};

export type KodamaEditorThemeStyle = CSSProperties & Record<`--${string}`, string>;

function asCssSize(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/** Map theme props → CSS custom properties consumed by `styles.css`. */
export function themeToCssVars(theme: KodamaEditorTheme | undefined): KodamaEditorThemeStyle {
  if (!theme) return {};

  const vars: KodamaEditorThemeStyle = {};

  if (theme.fontFamily) vars["--ke-font-body"] = theme.fontFamily;
  if (theme.headingFontFamily) vars["--ke-font-display"] = theme.headingFontFamily;
  if (theme.monoFontFamily) vars["--ke-font-mono"] = theme.monoFontFamily;

  const fontSize = asCssSize(theme.fontSize);
  if (fontSize) vars["--ke-font-size"] = fontSize;

  if (theme.backgroundColor) {
    vars["--ke-bg"] = theme.backgroundColor;
    vars["--note-bg"] = theme.backgroundColor;
  }
  if (theme.textColor) {
    vars["--ke-fg"] = theme.textColor;
    vars["--note-fg"] = theme.textColor;
  }
  if (theme.mutedColor) {
    vars["--ke-muted"] = theme.mutedColor;
    vars["--note-muted"] = theme.mutedColor;
  }
  if (theme.highlightColor) vars["--ke-highlight"] = theme.highlightColor;
  if (theme.selectionColor) vars["--ke-selection"] = theme.selectionColor;
  if (theme.primaryColor) vars["--ke-primary"] = theme.primaryColor;
  if (theme.borderColor) vars["--ke-border"] = theme.borderColor;
  if (theme.surfaceColor) vars["--ke-surface"] = theme.surfaceColor;

  if (theme.cssVariables) {
    for (const [key, value] of Object.entries(theme.cssVariables)) {
      if (!key || value == null) continue;
      const name = key.startsWith("--") ? key : `--${key}`;
      vars[name as `--${string}`] = value;
    }
  }

  return vars;
}

export function themeRootClassName(theme: KodamaEditorTheme | undefined, extra?: string): string {
  const parts = ["kodama-editor-root"];
  if (theme?.mode === "dark") parts.push("dark");
  if (theme?.mode === "light") parts.push("kodama-editor--light");
  if (extra) parts.push(extra);
  return parts.filter(Boolean).join(" ");
}