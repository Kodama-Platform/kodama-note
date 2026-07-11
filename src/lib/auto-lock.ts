export type AutoLockDuration = "5m" | "15m" | "30m" | "1h" | "never";

const STORAGE_KEY = "kodama-auto-lock";
const DEFAULT_DURATION: AutoLockDuration = "15m";

const DURATION_MS: Record<AutoLockDuration, number | null> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  never: null,
};

export const AUTO_LOCK_OPTIONS: ReadonlyArray<{
  value: AutoLockDuration;
  label: string;
  hint: string;
}> = [
  { value: "5m", label: "5 minutes", hint: "Lock after 5 minutes idle" },
  { value: "15m", label: "15 minutes", hint: "Lock after 15 minutes idle" },
  { value: "30m", label: "30 minutes", hint: "Lock after 30 minutes idle" },
  { value: "1h", label: "1 hour", hint: "Lock after 1 hour idle" },
  { value: "never", label: "Never", hint: "Only lock when you choose" },
];

function isAutoLockDuration(value: string | null): value is AutoLockDuration {
  return value === "5m" || value === "15m" || value === "30m" || value === "1h" || value === "never";
}

export function getAutoLockDuration(): AutoLockDuration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isAutoLockDuration(raw) ? raw : DEFAULT_DURATION;
  } catch {
    return DEFAULT_DURATION;
  }
}

export function getAutoLockMs(): number | null {
  return DURATION_MS[getAutoLockDuration()];
}

export function setAutoLockDuration(duration: AutoLockDuration): void {
  try {
    localStorage.setItem(STORAGE_KEY, duration);
  } catch {
    /* ignore quota / private mode */
  }
}

export function autoLockLabel(duration: AutoLockDuration): string {
  return AUTO_LOCK_OPTIONS.find((o) => o.value === duration)?.label ?? "15 minutes";
}
