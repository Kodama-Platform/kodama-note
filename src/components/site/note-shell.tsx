import type { ReactNode } from "react";

import { FeatureFooter } from "@/components/site/feature-footer";
import { ForestAtmosphere } from "@/components/site/forest-atmosphere";
import { HEADER_OFFSET } from "@/components/site/header-chrome";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SpiritCursor } from "@/components/site/spirit-cursor";

type FooterVariant = "site" | "feature" | false;

type NoteShellProps = {
  children: ReactNode;
  footer?: FooterVariant;
  centered?: boolean;
  showHeader?: boolean;
  atmosphere?: boolean;
  atmosphereClassName?: string;
  className?: string;
  /** Lock shell to viewport height so inner panes can scroll (editor page). */
  fillViewport?: boolean;
};

const CENTERED_MAIN_HEIGHT = "min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-4.5rem)]";
const CENTERED_MAIN_HEIGHT_NO_HEADER = "min-h-[100dvh]";

export function NoteShell({
  children,
  footer = false,
  centered = false,
  showHeader = true,
  atmosphere = true,
  atmosphereClassName = "note-atmosphere",
  className,
  fillViewport = false,
}: NoteShellProps) {
  const centeredMainClass = centered
    ? `flex items-center justify-center px-6 ${
        showHeader ? CENTERED_MAIN_HEIGHT : CENTERED_MAIN_HEIGHT_NO_HEADER
      }`
    : "";

  return (
    <div
      className={`relative flex flex-col overflow-x-clip bg-background text-foreground ${
        fillViewport ? "h-dvh min-h-0 overflow-hidden" : "min-h-screen"
      } ${className ?? ""}`}
    >
      <SpiritCursor />
      {atmosphere && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 z-0 ${atmosphereClassName}`}
        >
          <ForestAtmosphere />
        </div>
      )}

      <div
        className={`relative z-10 flex flex-col ${fillViewport ? "h-full min-h-0" : "min-h-screen"}`}
      >
        {showHeader && <SiteHeader />}

        <main
          id="main"
          className={`flex-1 ${showHeader ? HEADER_OFFSET : ""} ${centeredMainClass} ${
            fillViewport ? "flex min-h-0 flex-col" : ""
          }`}
        >
          {children}
        </main>

        {footer === "site" && <SiteFooter />}
        {footer === "feature" && <FeatureFooter />}
      </div>
    </div>
  );
}
