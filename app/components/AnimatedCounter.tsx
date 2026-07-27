"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface AnimatedCounterProps {
  /** The target numeric value to count up to */
  target: number;
  /** Suffix displayed after the number, e.g. "K+", "M+" */
  suffix?: string;
  /** Animation duration in milliseconds (default 1400) */
  duration?: number;
  className?: string;
}

/**
 * Counts from 0 to `target`.
 * - Runs on first mount (page load / hard refresh)
 * - Re-runs every time the tab regains focus (window "focus" + "visibilitychange")
 * Uses an ease-out cubic curve so it starts fast and decelerates near the end.
 */
export default function AnimatedCounter({
  target,
  suffix = "",
  duration = 1400,
  className,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  const runAnimation = useCallback(() => {
    // Cancel any in-flight animation before starting a new one
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    setCount(0);
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic: fast start, slow finish
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCount(target);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [target, duration]);

  useEffect(() => {
    // Run immediately on mount
    runAnimation();

    // Re-run when the user comes back to the tab
    const onFocus = () => runAnimation();
    const onVisibility = () => {
      if (document.visibilityState === "visible") runAnimation();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [runAnimation]);

  return (
    <span className={className}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}
