import { useEffect, useState } from "react";

export const HEADER_INNER =
  "mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6 lg:h-[72px] lg:px-10";

export const HEADER_OFFSET = "pt-14 sm:pt-16 lg:pt-[72px]";

export function useHeaderScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

export function headerShellClass(scrolled: boolean, menuOpen = false) {
  return `fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
    scrolled || menuOpen
      ? "border-b border-border/70 bg-background/85 backdrop-blur-md"
      : "border-b border-transparent bg-transparent"
  }`;
}

export function headerLogoClass() {
  return "group flex min-w-0 items-center gap-2 sm:gap-2.5";
}

export function headerLogoMarkClass() {
  return "shrink-0 text-primary transition-transform duration-500 group-hover:-translate-y-0.5";
}

export function headerLogoTextClass() {
  return "truncate font-display text-base tracking-tight text-foreground sm:text-lg lg:text-xl";
}
