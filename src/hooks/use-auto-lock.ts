import { useCallback, useEffect, useRef } from "react";

type UseAutoLockOptions = {
  enabled: boolean;
  durationMs: number | null;
  onInactive: () => void;
};

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function useAutoLock({ enabled, durationMs, onInactive }: UseAutoLockOptions): void {
  const onInactiveRef = useRef(onInactive);
  onInactiveRef.current = onInactive;

  const resetTimer = useCallback(() => {
    if (!enabled || durationMs == null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onInactiveRef.current();
    }, durationMs);
  }, [durationMs, enabled]);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || durationMs == null) {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let lastMove = 0;
    const onActivity = () => resetTimer();
    const onMouseMove = () => {
      const now = Date.now();
      if (now - lastMove < 30_000) return;
      lastMove = now;
      resetTimer();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { capture: true, passive: true });
    }
    window.addEventListener("mousemove", onMouseMove, { capture: true, passive: true });
    resetTimer();

    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, true);
      }
      window.removeEventListener("mousemove", onMouseMove, true);
    };
  }, [durationMs, enabled, resetTimer]);
}
