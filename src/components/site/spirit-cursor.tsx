import { useEffect, useRef } from "react";

/** Soft kodama spirit firefly trailing the cursor — from kodama.page. */
export function SpiritCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduced) return;

    const glow = glowRef.current;
    const dot = dotRef.current;
    if (!glow || !dot) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let gx = mx;
    let gy = my;
    let raf = 0;

    const move = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;

      const target = e.target;
      const interactive =
        target instanceof Element &&
        target.closest('a, button, [role="button"], input, textarea, select, label');

      glow.style.width = interactive ? "56px" : "26px";
      glow.style.height = interactive ? "56px" : "26px";
      glow.style.opacity = interactive ? "0.9" : "0.55";
    };

    const loop = () => {
      gx += (mx - gx) * 0.14;
      gy += (my - gy) * 0.14;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    document.documentElement.classList.add("spirit-active");

    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("spirit-active");
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] hidden md:block">
      <div
        ref={glowRef}
        className="spirit-glow absolute -left-3 -top-3 rounded-full"
        style={{ width: 26, height: 26 }}
      />
      <div
        ref={dotRef}
        className="spirit-dot absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full"
      />
    </div>
  );
}
