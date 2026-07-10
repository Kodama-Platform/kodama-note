import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { SITE } from "@/lib/brand";

export function FeatureFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left lg:px-8">
        <div>
          <p className="font-display text-base tracking-tight text-foreground sm:text-[15px]">
            Kodama Note
          </p>
          <p className="mt-1 inline-flex items-center justify-center gap-1.5 font-sans text-sm font-light text-muted-foreground sm:justify-start sm:text-[12px]">
            <ShieldCheck className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
            Encrypted in your browser before upload
          </p>
        </div>
        <nav
          aria-label="Feature footer"
          className="flex flex-col items-center gap-2 sm:items-end"
        >
          <Link
            to="/security"
            className="inline-flex min-h-9 items-center font-sans text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
          >
            Security
          </Link>
          <a
            href={SITE.mainUrl}
            className="inline-flex min-h-9 items-center font-sans text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to Kodama Forest
          </a>
        </nav>
      </div>
    </footer>
  );
}
