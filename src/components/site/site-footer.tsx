import { Link } from "@tanstack/react-router";

import { KodamaMark } from "@/components/kodama-mark";
import { Reveal } from "@/components/site/reveal";
import { FOREST_LINKS, NOTE_NAV, sectionHref } from "@/lib/nav";
import { SITE } from "@/lib/brand";
import { cn } from "@/lib/utils";

const BG = "rgb(10 11 9)";
const CREAM = "rgb(244 242 236)";
const CLAY = "rgb(132 158 124)";

const footerNavClass =
  "group relative inline-flex min-h-9 w-full items-center justify-center px-1 text-center font-mono text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 sm:min-h-0 sm:w-auto sm:px-0 sm:text-xs sm:tracking-[0.24em]";

export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden" style={{ backgroundColor: BG, color: CREAM }}>
      <div className="grain pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${CLAY}55, transparent)` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-80"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 130%, rgb(224 148 76 / 0.07), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-24 sm:pt-32 lg:pt-40">
        <Reveal>
          <p className="font-display text-[1.35rem] font-light leading-[1.4] tracking-[-0.01em] sm:text-3xl lg:text-5xl lg:leading-[1.38]">
            <span className="block">The forest doesn&apos;t ask</span>
            <span className="block" style={{ color: "rgb(244 242 236 / 0.5)" }}>
              who you are.
            </span>
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-5 font-display text-[1.35rem] font-light leading-[1.4] tracking-[-0.01em] sm:mt-8 sm:text-3xl lg:text-5xl lg:leading-[1.38]">
            <span className="block">It simply gives you</span>
            <span className="block italic text-primary">a place.</span>
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="mt-14 flex flex-col items-center gap-4 sm:mt-20">
            <KodamaMark size={36} className="text-[#F4F2EC] sm:hidden" holeClassName="fill-[#060807]" />
            <KodamaMark size={40} className="hidden text-[#F4F2EC] sm:block" holeClassName="fill-[#060807]" />
            <span className="font-display text-lg tracking-tight sm:text-2xl">Kodama Note</span>
            <div className="mt-1 flex w-full max-w-xs flex-col items-center gap-3 sm:max-w-none">
              <Link
                to="/"
                className="group relative inline-flex min-h-11 items-center font-mono text-sm uppercase tracking-[0.22em] text-primary transition-opacity duration-300 hover:opacity-100 sm:tracking-[0.34em]"
              >
                Name your place.
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-primary transition-all duration-500 ease-out group-hover:w-full" />
              </Link>
              <a
                href={`${SITE.mainUrl}/support`}
                className="group relative inline-flex min-h-11 items-center font-mono text-sm uppercase tracking-[0.18em] transition-opacity duration-300 hover:opacity-100 sm:text-xs sm:tracking-[0.28em]"
                style={{ color: "rgb(244 242 236 / 0.45)" }}
              >
                Support the forest
                <span
                  className="absolute -bottom-1 left-0 h-px w-0 transition-all duration-500 ease-out group-hover:w-full"
                  style={{ backgroundColor: CLAY }}
                />
              </a>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="relative border-t" style={{ borderColor: "rgb(244 242 236 / 0.12)" }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-8 sm:flex-row sm:justify-between sm:gap-5 sm:px-6 sm:py-6 lg:px-10">
          <nav
            className="grid w-full grid-cols-2 gap-x-2 gap-y-0.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-7 sm:gap-y-2"
            aria-label="Footer"
          >
            {NOTE_NAV.map((item) =>
              "to" in item ? (
                <FooterNavLink key={item.label} to={item.to}>
                  {item.label}
                </FooterNavLink>
              ) : (
                <FooterNavAnchor key={item.label} href={sectionHref(item.section)}>
                  {item.label}
                </FooterNavAnchor>
              ),
            )}
            {FOREST_LINKS.map((item) => (
              <FooterNavAnchor key={item.label} href={item.href}>
                {item.label}
              </FooterNavAnchor>
            ))}
          </nav>
          <p
            className="font-mono text-[11px] uppercase tracking-[0.2em] sm:text-xs sm:tracking-[0.24em]"
            style={{ color: "rgb(244 242 236 / 0.35)" }}
          >
            © {new Date().getFullYear()} Kodama
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className={cn(footerNavClass)} style={{ color: "rgb(244 242 236 / 0.55)" }}>
      {children}
      <FooterNavUnderline />
    </Link>
  );
}

function FooterNavAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={cn(footerNavClass)} style={{ color: "rgb(244 242 236 / 0.55)" }}>
      {children}
      <FooterNavUnderline />
    </a>
  );
}

function FooterNavUnderline() {
  return (
    <span
      className="absolute -bottom-1 left-0 hidden h-px w-0 transition-all duration-500 ease-out group-hover:w-full sm:block"
      style={{ backgroundColor: CLAY }}
    />
  );
}
