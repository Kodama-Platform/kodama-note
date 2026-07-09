import { Link } from "@tanstack/react-router";

import { KodamaMark } from "@/components/kodama-mark";
import { SITE } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/50 px-6 py-10 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="font-display text-base tracking-tight text-foreground sm:text-[15px]">Kodama Note</p>
          <p className="mt-1 font-sans text-sm font-light leading-relaxed text-muted-foreground sm:text-[12px]">
            Your place for ideas. Part of the Kodama Forest.
          </p>
        </div>
        <a
          href={SITE.mainUrl}
          className="inline-flex min-h-11 items-center font-sans text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-0 sm:text-[12px]"
        >
          ← Back to Kodama
        </a>
      </div>
    </footer>
  );
}

export function FooterCompact() {
  return (
    <footer className="border-t border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-[15px] tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          <KodamaMark size={22} />
          Kodama Note
        </Link>
        <p className="hidden text-[11px] font-light text-muted-foreground sm:block">
          Zero-knowledge encryption
        </p>
      </div>
    </footer>
  );
}
