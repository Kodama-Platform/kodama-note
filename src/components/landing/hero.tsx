import { useCallback, useState } from "react";

import { KodamaMark } from "@/components/kodama-mark";
import { PlaceInput } from "@/components/landing/place-input";
import { useHeroPointer } from "@/hooks/use-hero-pointer";

export function Hero({ heroRef }: { heroRef: React.RefObject<HTMLElement | null> }) {
  const [sectionEl, setSectionEl] = useState<HTMLElement | null>(null);
  const { markRef, glowRef } = useHeroPointer(sectionEl);

  const setSectionRef = useCallback(
    (node: HTMLElement | null) => {
      setSectionEl(node);
      if (heroRef && "current" in heroRef) {
        (heroRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    [heroRef],
  );

  return (
    <section
      ref={setSectionRef}
      aria-label="Create a note"
      className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden scroll-mt-20 sm:min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100svh-4.5rem)]"
    >
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute z-0 h-[min(560px,80vw)] w-[min(560px,80vw)] rounded-full blur-[90px]"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(closest-side, rgb(var(--primary) / 0.13), transparent)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center px-4 py-6 text-center sm:px-8 sm:py-8">
        <div className="animate-rise flex justify-center">
          <div ref={markRef} className="[will-change:transform]">
            <KodamaMark size={40} className="animate-breathe text-primary sm:hidden" />
            <KodamaMark size={46} className="animate-breathe hidden text-primary sm:block" />
          </div>
        </div>

        <div className="mt-5 w-full sm:mt-8">
          <PlaceInput inputId="page-name" />
        </div>
      </div>
    </section>
  );
}
