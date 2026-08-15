"use client";

import { useEffect, useState } from "react";

/**
 * useCountUp — animates a number from 0 to `target` over `duration` ms.
 * Returns { value, done }. `done` flips true once settled, so callers can
 * drop the .count-up-active pulse class at that point.
 *
 * Usage:
 *   const { value, done } = useCountUp(welcomeBonus.ryo, { delay: 200 });
 */
interface UseCountUpOptions {
  duration?: number;
  delay?: number;
}

export function useCountUp(
  target: number,
  { duration = 900, delay = 0 }: UseCountUpOptions = {},
) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) {
      setValue(target);
      setDone(true);
      return;
    }
    setDone(false);
    let raf: number;
    let start: number | null = null;

    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (start === null) start = ts;
        const elapsed = ts - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out-quint — fast start, gentle settle
        const eased = 1 - Math.pow(1 - progress, 5);
        setValue(Math.round(eased * target));
        if (progress < 1) {
          raf = requestAnimationFrame(step);
        } else {
          setDone(true);
        }
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);

  return { value, done };
}
