"use client";

import { useMemo } from "react";

/**
 * EmberField — drifting gold ember/spirit particles for auth page atmosphere.
 * Purely decorative, pointer-events-none, respects prefers-reduced-motion
 * via the .ember-particle CSS rule in globals.css.
 *
 * Usage:
 *   <EmberField count={14} />
 * Place absolutely inside a `relative overflow-hidden` page wrapper.
 */
interface EmberFieldProps {
  count?: number;
}

export function EmberField({ count = 14 }: EmberFieldProps) {
  const embers = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        duration: 9 + Math.random() * 10,
        delay: Math.random() * -18,
        driftX: (Math.random() - 0.5) * 80,
        scale: 0.6 + Math.random() * 0.9,
      })),
    [count],
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {embers.map((e) => (
        <span
          key={e.id}
          className="ember-particle"
          style={
            {
              left: `${e.left}%`,
              animationDuration: `${e.duration}s`,
              animationDelay: `${e.delay}s`,
              "--ember-drift-x": `${e.driftX}px`,
              transform: `scale(${e.scale})`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
