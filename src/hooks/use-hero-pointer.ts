import { useEffect, useRef } from "react";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mapRange(v: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type PointerTarget = { x: number; y: number };

/** Max normalized offset — cursor outside the hero still pushes toward this tilt. */
const MAX_OFFSET = 0.85;

/** Cursor-driven parallax — updates DOM directly so CSS animations can't override transform. */
export function useHeroPointer(sectionEl: HTMLElement | null) {
  const markRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const target = useRef<PointerTarget>({ x: 0, y: 0 });
  const current = useRef<PointerTarget>({ x: 0, y: 0 });

  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reduced || !sectionEl) return;

    const onMove = (e: PointerEvent) => {
      const r = sectionEl.getBoundingClientRect();
      // Track cursor relative to hero bounds everywhere on the page — not only when inside.
      target.current = {
        x: clamp((e.clientX - r.left) / r.width - 0.5, -MAX_OFFSET, MAX_OFFSET),
        y: clamp((e.clientY - r.top) / r.height - 0.5, -MAX_OFFSET, MAX_OFFSET),
      };
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    const tick = () => {
      current.current = {
        x: lerp(current.current.x, target.current.x, 0.12),
        y: lerp(current.current.y, target.current.y, 0.12),
      };
      const { x, y } = current.current;

      const markX = mapRange(x, -MAX_OFFSET, MAX_OFFSET, -16, 16);
      const markY = mapRange(y, -MAX_OFFSET, MAX_OFFSET, -11, 11);
      const markRotate = mapRange(x, -MAX_OFFSET, MAX_OFFSET, -6, 6);
      const glowLeft = mapRange(x, -MAX_OFFSET, MAX_OFFSET, 36, 64);
      const glowTop = mapRange(y, -MAX_OFFSET, MAX_OFFSET, 34, 62);

      if (markRef.current) {
        markRef.current.style.transform = `translate3d(${markX}px, ${markY}px, 0) rotate(${markRotate}deg)`;
      }
      if (glowRef.current) {
        glowRef.current.style.left = `${glowLeft}%`;
        glowRef.current.style.top = `${glowTop}%`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [sectionEl]);

  return { markRef, glowRef };
}
