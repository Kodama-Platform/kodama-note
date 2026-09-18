import { createEmptyWorkbook, serializeWorkbook } from "@/lib/workbook";

/**
 * UI-polish mode: skip password / KNP encryption and persist workbooks in localStorage.
 * On in `npm run dev` by default. Set `VITE_PLAINTEXT_MODE=false` to restore crypto.
 * In production builds, set `VITE_PLAINTEXT_MODE=true` explicitly to enable.
 */
export function isPlaintextMode(): boolean {
  const flag = import.meta.env.VITE_PLAINTEXT_MODE;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;

  return import.meta.env.DEV;
}

function storageKey(slug: string): string {
  return `kodama:plaintext:${slug}`;
}

export function loadPlaintextWorkbook(slug: string): string {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (raw?.trim()) return raw;
  } catch {
    /* ignore */
  }
  return serializeWorkbook(createEmptyWorkbook());
}

export function savePlaintextWorkbook(slug: string, plaintext: string): void {
  localStorage.setItem(storageKey(slug), plaintext);
}

export function clearPlaintextWorkbook(slug: string): void {
  try {
    localStorage.removeItem(storageKey(slug));
  } catch {
    /* ignore */
  }
}
