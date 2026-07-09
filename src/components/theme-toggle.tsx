import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setTheme,
  watchSystemTheme,
  type Theme,
} from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setLocal] = useState<Theme>("system");

  useEffect(() => {
    const t = getStoredTheme();
    setLocal(t);
    applyTheme(t);
    const unsub = watchSystemTheme(() => {
      if (getStoredTheme() === "system") applyTheme("system");
    });
    return unsub;
  }, []);

  // Cycle light → dark → system
  const cycle = () => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setLocal(next);
    setTheme(next);
  };

  const resolved = resolveTheme(theme);
  const Icon = theme === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme}`}
      onClick={cycle}
      className={
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-all duration-300 hover:scale-105 hover:text-foreground " +
        (className ?? "")
      }
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
