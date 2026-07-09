export const KODAMA_MARK_URL = "/kodama-mark.svg";
export const KODAMA_FAVICON_URL = "/favicon.ico";
export const KODAMA_ICON_32_URL = "/favicon-32.png";
export const KODAMA_ICON_192_URL = "/kodama-icon-192.png";
export const KODAMA_ICON_256_URL = "/kodama-icon-256.png";
export const KODAMA_APPLE_TOUCH_ICON_URL = "/apple-touch-icon.png";

export const SITE = {
  name: "Kodama",
  url: "https://note.kodama.page",
  mainUrl: "https://kodama.page",
  github: "https://github.com/itcvmaster/note.kodama.page",
} as const;

/** Kodama brand palette — mirrors brand.kodama.page */
export const BRAND_COLORS = {
  light: {
    background: "#F7F5F0",
    surface: "#EFECE5",
    border: "#D8D4CA",
    text: "#2D2C2A",
    textMuted: "#5C5A56",
    accent: "#7A8B76",
    accentMuted: "#A3B19F",
  },
  dark: {
    background: "#141514",
    surface: "#1C1E1C",
    border: "#2D302D",
    text: "#E6E8E6",
    textMuted: "#9AA09A",
    accent: "#8F9F8B",
    accentMuted: "#5C6A58",
  },
} as const;
