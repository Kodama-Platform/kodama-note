// Theme manager — supports light, dark, system. Persists choice to localStorage.
// The no-flash inline script lives in index.html.

export type Theme = "light" | "dark" | "system";

const KEY = "kodama-theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(KEY) as Theme | null;
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function updateThemeColorMeta(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#1a1d1b" : "#F6F4F0");
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  updateThemeColorMeta(resolved);
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

let mqlListener: ((e: MediaQueryListEvent) => void) | null = null;
export function watchSystemTheme(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mqlListener = () => onChange();
  mql.addEventListener("change", mqlListener);
  return () => {
    if (mqlListener) mql.removeEventListener("change", mqlListener);
  };
}
