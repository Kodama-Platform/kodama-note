export type SaveMode = "auto" | "manual";

const STORAGE_KEY = "kodama-save-mode";
const DEFAULT_SAVE_MODE: SaveMode = "auto";

export function getSaveMode(): SaveMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "manual" ? "manual" : DEFAULT_SAVE_MODE;
  } catch {
    return DEFAULT_SAVE_MODE;
  }
}

export function setSaveMode(mode: SaveMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}
