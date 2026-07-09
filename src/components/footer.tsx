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
