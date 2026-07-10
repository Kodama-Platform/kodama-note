import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Menu } from "lucide-react";

import { KodamaMark } from "@/components/kodama-mark";
import { NoteMobileMenu } from "@/components/site/note-mobile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  HEADER_INNER,
  headerLogoClass,
  headerLogoMarkClass,
  headerLogoTextClass,
  headerShellClass,
  useHeaderScrolled,
} from "@/components/site/header-chrome";
import { FOREST_LINKS, NOTE_NAV, sectionHref } from "@/lib/nav";

type SiteHeaderProps = {
  onScrollTo?: (id: string) => void;
};

export function SiteHeader({ onScrollTo }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useHeaderScrolled();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHome = pathname === "/";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const openNote = () => {
    if (onHome && onScrollTo) {
      onScrollTo("page-name");
      return;
    }
    window.location.assign("/#page-name");
  };

  return (
    <>
      <header className={headerShellClass(scrolled, menuOpen)}>
        <div className={HEADER_INNER}>
          <Link to="/" className={headerLogoClass()}>
            <KodamaMark size={26} className={`${headerLogoMarkClass()} sm:hidden`} />
            <KodamaMark size={28} className={`${headerLogoMarkClass()} hidden sm:block`} />
            <span className={headerLogoTextClass()}>
              <span className="sm:hidden">Note</span>
              <span className="hidden sm:inline">Kodama Note</span>
            </span>
          </Link>

          <nav aria-label="Note" className="hidden items-center gap-6 lg:flex xl:gap-8">
            {NOTE_NAV.map((item) => {
              if ("to" in item) {
                const isActive = pathname === item.to;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`group relative py-1 font-sans text-sm font-light tracking-tight transition-colors duration-300 ${
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                    <span
                      className={`absolute -bottom-0.5 left-0 h-px bg-primary transition-all duration-300 ${
                        isActive ? "w-full" : "w-0 group-hover:w-full"
                      }`}
                    />
                  </Link>
                );
              }

              const sectionId = item.section;
              if (onHome && onScrollTo) {
                return (
                  <NavScrollButton key={item.label} id={sectionId} onScrollTo={onScrollTo}>
                    {item.label}
                  </NavScrollButton>
                );
              }

              return (
                <a
                  key={item.label}
                  href={sectionHref(sectionId)}
                  className="group relative py-1 font-sans text-sm font-light tracking-tight text-muted-foreground transition-colors duration-300 hover:text-foreground"
                >
                  {item.label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
                </a>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <nav aria-label="Forest" className="hidden items-center lg:flex">
              <a
                href={FOREST_LINKS[0].href}
                className="font-sans text-sm font-light text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                {FOREST_LINKS[0].label}
              </a>
            </nav>

            <ThemeToggle />

            <button type="button" onClick={openNote} className="btn-moss hidden lg:inline-flex">
              Open a note
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border px-3 text-foreground transition-all duration-300 hover:border-primary/50 sm:px-3.5 lg:hidden"
            >
              <Menu className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="hidden font-mono text-xs uppercase tracking-[0.22em] sm:inline sm:text-sm">
                Menu
              </span>
            </button>
          </div>
        </div>
      </header>

      <NoteMobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
        onHome={onHome}
        onScrollTo={onScrollTo}
        onOpenNote={openNote}
      />
    </>
  );
}

function NavScrollButton({
  id,
  children,
  onScrollTo,
}: {
  id: string;
  children: React.ReactNode;
  onScrollTo?: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onScrollTo?.(id)}
      className="group relative py-1 font-sans text-sm font-light tracking-tight text-muted-foreground transition-colors duration-300 hover:text-foreground"
    >
      {children}
      <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
    </button>
  );
}
