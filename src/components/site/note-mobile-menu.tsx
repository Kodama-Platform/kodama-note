import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";

import { KodamaMark } from "@/components/kodama-mark";
import { FOREST_LINKS, NOTE_NAV, sectionHref } from "@/lib/nav";

type NoteMobileMenuProps = {
  open: boolean;
  onClose: () => void;
  pathname: string;
  onHome: boolean;
  onScrollTo?: (id: string) => void;
  onOpenNote: () => void;
};

export function NoteMobileMenu({
  open,
  onClose,
  pathname,
  onHome,
  onScrollTo,
  onOpenNote,
}: NoteMobileMenuProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-background/95 backdrop-blur-xl"
        onClick={onClose}
      />

      <div className="relative mx-auto flex h-full max-w-lg flex-col px-5 pb-8 pt-4">
        <div className="flex items-center justify-between">
          <Link to="/" onClick={onClose} className="inline-flex items-center gap-2">
            <KodamaMark size={26} className="text-primary" />
            <span className="font-display text-lg tracking-tight text-foreground">Kodama Note</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary/50"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <nav aria-label="Menu" className="mt-10 flex flex-1 flex-col gap-1">
          {NOTE_NAV.map((item) => {
            if ("to" in item) {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={onClose}
                  className={`rounded-xl px-3 py-3.5 font-display text-2xl font-light tracking-tight transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            }

            if (onHome && onScrollTo) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    onScrollTo(item.section);
                    onClose();
                  }}
                  className="rounded-xl px-3 py-3.5 text-left font-display text-2xl font-light tracking-tight text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </button>
              );
            }

            return (
              <a
                key={item.label}
                href={sectionHref(item.section)}
                onClick={onClose}
                className="rounded-xl px-3 py-3.5 font-display text-2xl font-light tracking-tight text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-6">
          <button
            type="button"
            onClick={() => {
              onOpenNote();
              onClose();
            }}
            className="btn-moss w-full justify-center"
          >
            Open a note
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <a
            href={FOREST_LINKS[0].href}
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center font-sans text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
          >
            {FOREST_LINKS[0].label}
          </a>
        </div>
      </div>
    </div>
  );
}
