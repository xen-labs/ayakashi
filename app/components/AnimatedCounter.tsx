"use client";

import { useEffect, useRef, useState } from "react";

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
 * Counts from 0 to `target` once the element enters the viewport.
 * Uses an ease-out curve so it starts fast and decelerates near the end.
 */
export default function AnimatedCounter({
  target,
  suffix = "",
  duration = 1400,
  className,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          observer.disconnect();

          const startTime = performance.now();

          const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic: fast start, slow finish
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));

            if (progress < 1) {
              requestAnimationFrame(tick);
            } else {
              setCount(target);
            }
          };

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref} className={className}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}
