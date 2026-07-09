import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";

const DISMISS_KEY = "kodama-donate-dismissed-v1";
const VISITS_KEY = "kodama-visits";

function donateUrl(): string {
  const v = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_DONATE_URL;
  return v || "https://ko-fi.com/";
}

export function useVisitCount(slug: string): number {
  const [count, setCount] = useState(1);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISITS_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      map[slug] = (map[slug] ?? 0) + 1;
      localStorage.setItem(VISITS_KEY, JSON.stringify(map));
      setCount(map[slug]);
    } catch {
      /* ignore */
    }
  }, [slug]);
  return count;
}

export function DonateRibbon({
  sessionWords,
  visits,
}: {
  sessionWords: number;
  visits: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    if (sessionWords >= 500 || visits >= 3) setShow(true);
  }, [sessionWords, visits]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-14 z-30 mx-auto max-w-xl rounded-2xl border border-border bg-popover/95 p-3 shadow-soft backdrop-blur sm:inset-x-auto sm:right-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Heart className="h-4 w-4" />
        </div>
        <div className="flex-1 text-xs text-foreground">
          <p className="font-medium">Kodama is free and ad-free.</p>
          <p className="mt-0.5 text-muted-foreground">
            If it earned a spot in your workflow, you can buy us a coffee.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <a
              href={donateUrl()}
              target="_blank"
              rel="noreferrer noopener"
              onClick={dismiss}
              className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
            >
              Support Kodama
            </a>
            <button
              onClick={dismiss}
              className="inline-flex h-8 items-center rounded-full px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
