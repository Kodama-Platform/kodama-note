import type { ReactNode } from "react";

import { ForestAtmosphere } from "@/components/site/forest-atmosphere";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SpiritCursor } from "@/components/site/spirit-cursor";

type SiteLayoutProps = {
  children: ReactNode;
  header?: "default" | "note";
  footer?: boolean;
  atmosphere?: boolean;
  onScrollTo?: (id: string) => void;
};

export function SiteLayout({
  children,
  header = "default",
  footer = true,
  atmosphere = true,
  onScrollTo,
}: SiteLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      <SpiritCursor />
      {atmosphere && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <ForestAtmosphere />
        </div>
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-full focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:font-sans focus-visible:text-sm focus-visible:text-primary-foreground"
        >
          Skip to content
        </a>

        <SiteHeader variant={header} onScrollTo={onScrollTo} />

        <main id="main" className={`flex-1 ${header !== "note" ? "pt-14 sm:pt-16 lg:pt-[72px]" : ""}`}>
          {children}
        </main>

        {footer && <SiteFooter />}
      </div>
    </div>
  );
}
