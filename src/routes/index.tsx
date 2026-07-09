import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Hero } from "@/components/landing/hero";
import { ProductMockup } from "@/components/landing/product-mockup";
import { Reveal } from "@/components/site/reveal";
import { SiteLayout } from "@/components/site/site-layout";
import { CryptoSpec } from "@/components/security/crypto-spec";
import { ThreatModelFlow } from "@/components/security/threat-model-flow";
import { VisibilityTable } from "@/components/security/visibility-table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";
import { SITE } from "@/lib/brand";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FAQ = [
  {
    q: "Can Kodama read my pages?",
    a: "No. Contents are encrypted in your browser before upload. We store ciphertext we cannot decrypt without your password — and we never receive your password.",
  },
  {
    q: "Can I recover my password?",
    a: "No. We cannot reset passwords because we never receive them. If you lose your password, the page is permanently unreadable.",
  },
  {
    q: "What can Kodama see about my page?",
    a: "The slug, encrypted blob, salt, IV, KDF parameters, timestamps, and approximate size. Not the contents, password, or encryption key. See our security page for the full list.",
  },
  {
    q: "How long are pages stored?",
    a: "By default, until you delete them or they expire. You can set burn-after-read or timed expiry (1 hour, 24 hours, or 7 days).",
  },
  {
    q: "How is encryption implemented?",
    a: "Argon2id derives a 256-bit key from your password. AES-256-GCM encrypts content in the browser via the Web Crypto API. See the cryptography specification on our security page.",
  },
  {
    q: "Has Kodama been independently audited?",
    a: "Not yet. We publish our cryptography specification and client implementation for expert review. Audit results will be posted on the security page when available.",
  },
] as const;

function Landing() {
  const isMobile = useIsMobile();
  const heroRef = useRef<HTMLElement>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLInputElement) {
      window.setTimeout(() => el.focus(), 400);
    }
  };

  return (
    <SiteLayout onScrollTo={scrollTo}>
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <Hero heroRef={heroRef} />

        <section id="threat-model" className="scroll-mt-20 border-t border-border/50 pb-20 sm:pb-28">
          <Reveal>
            <div className="mx-auto max-w-3xl pt-16 text-center sm:pt-20">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-clay sm:text-xs sm:tracking-[0.34em]">
                Privacy
              </p>
              <h2 className="mt-3 font-display text-[1.65rem] font-light leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                How your data stays private
              </h2>
              <p className="mt-3 text-base font-light leading-relaxed text-muted-foreground sm:text-base">
                Encryption happens in your browser before anything is uploaded.
              </p>
            </div>
          </Reveal>
          <div className="mt-10">
            <ThreatModelFlow />
          </div>
          <p className="mx-auto mt-8 max-w-lg text-center text-base text-muted-foreground sm:text-sm">
            <Link to="/security" className="text-foreground underline underline-offset-4 hover:text-primary">
              Read the full security specification →
            </Link>
          </p>
        </section>

        <section className="pb-20 sm:pb-28" aria-label="Product preview">
          <Reveal>
            <ProductMockup />
          </Reveal>
        </section>

        <section className="pb-20 sm:pb-28">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-[1.5rem] font-light leading-tight tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                What we know — and what we don&apos;t
              </h2>
              <p className="mt-3 text-base font-light leading-relaxed text-muted-foreground">
                Transparency builds trust. Here is exactly what Kodama can access.
              </p>
            </div>
          </Reveal>
          <div className="mx-auto mt-10 max-w-4xl">
            <VisibilityTable />
          </div>
        </section>

        <section className="pb-20 sm:pb-28">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-[1.5rem] font-light leading-tight tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                Cryptography specification
              </h2>
              <p className="mt-3 text-base font-light leading-relaxed text-muted-foreground">
                Published for expert review — not hidden behind marketing language.
              </p>
            </div>
          </Reveal>
          <div className="mt-10">
            <CryptoSpec />
          </div>
          <p className="mx-auto mt-8 max-w-lg text-center text-base text-muted-foreground sm:text-sm">
            <Link to="/security" className="text-foreground underline underline-offset-4 hover:text-primary">
              Full technical details, threat model, and limitations →
            </Link>
          </p>
        </section>

        <section className="pb-20 sm:pb-28">
          <Reveal>
            <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-lg font-light leading-snug tracking-tight text-foreground sm:text-xl">
                    What we cannot do for you
                  </h2>
                  <ul className="mt-4 space-y-3 text-base font-light leading-relaxed text-muted-foreground sm:text-sm">
                    <li>
                      If you lose your password, we{" "}
                      <strong className="font-medium text-foreground">cannot recover</strong> your page.
                    </li>
                    <li>
                      We <strong className="font-medium text-foreground">cannot reset</strong> passwords
                      — we never receive them.
                    </li>
                    <li>
                      Page slugs are{" "}
                      <strong className="font-medium text-foreground">publicly guessable</strong> — only
                      contents are encrypted.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="pb-20 sm:pb-28">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-[1.5rem] font-light leading-tight tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                Built by Kodama
              </h2>
              <p className="mt-4 text-base font-light leading-relaxed text-muted-foreground">
                We make quiet internet tools — small, private, and free of dark patterns. Note exists
                because sharing text securely should not require trusting a company to behave well with
                your data.
              </p>
              <p className="mt-4 text-base text-muted-foreground">
                <a
                  href={`${SITE.mainUrl}/about`}
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  About Kodama →
                </a>
                <span className="mx-2 text-border">·</span>
                <a
                  href={`${SITE.mainUrl}/support`}
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Contact →
                </a>
              </p>
            </div>
          </Reveal>
        </section>

        <section id="faq" className="pb-24 sm:pb-32">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-[1.5rem] font-light leading-tight tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                Frequently asked questions
              </h2>
            </div>
          </Reveal>

          <Accordion type="single" collapsible className="mx-auto mt-10 max-w-2xl">
            {FAQ.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className="text-left text-base text-foreground sm:text-sm">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed text-muted-foreground sm:text-sm">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>

      {isMobile && showStickyCta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur-md sm:hidden">
          <button
            type="button"
            onClick={() => scrollTo("page-name")}
            className="btn-moss flex h-12 w-full items-center justify-center"
          >
            Create encrypted page
          </button>
        </div>
      )}
    </SiteLayout>
  );
}
