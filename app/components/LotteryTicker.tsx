"use client";

import { useEffect, useState } from "react";
import { CurrencyIcon } from "./CurrencyIcon";
import { getLotteryRecentWinners } from "../../lib/api";
import type { LotteryPool } from "../../lib/api";

/**
 * LotteryTicker — recent draw history, newest pool first.
 * Shows the prize pool and top placements per draw. Silently renders
 * nothing if the fetch fails or comes back empty, so it never leaves a
 * broken-looking section on the homepage.
 *
 * @param limit Max draws to render. Defaults to 6 (unchanged behavior
 *   for any existing caller that doesn't pass one). The homepage
 *   passes limit={3} — both logged-in and logged-out.
 */
export function LotteryTicker({ limit = 6 }: { limit?: number }) {
  const [pools, setPools] = useState<LotteryPool[] | null>(null);

  useEffect(() => {
    getLotteryRecentWinners()
      .then((res) => setPools(res.pools))
      .catch(() => setPools([]));
  }, []);

  if (pools === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.min(limit, 3) }, (_, i) => (
          <div
            key={i}
            className="form-card h-32 animate-pulse border p-5 opacity-40"
          />
        ))}
      </div>
    );
  }

  if (pools.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pools.slice(0, limit).map((pool, i) => {
        const top =
          pool.winners.find((w) => w.placement === 1) ?? pool.winners[0];
        const date = new Date(pool.resolvedAt);
        return (
          <div
            key={pool.resolvedAt}
            className="form-card stagger-in relative overflow-hidden border p-5"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="hero-ray-sweep pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40" />
            <div className="relative z-10 flex items-center justify-between">
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-[rgba(200,168,75,0.45)]">
                {date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-[rgba(200,168,75,0.35)]">
                Draw
              </span>
            </div>

            <div className="relative z-10 mt-3 flex items-center gap-2">
              <CurrencyIcon type="kitsu" size={20} className="coin-float" />
              <span className="font-display stat-glow text-xl font-bold text-[#c8a84b]">
                {pool.prizePool.toLocaleString("en-US")}
              </span>
              <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.4)]">
                pool
              </span>
            </div>

            {top && (
              <div className="relative z-10 mt-3 flex items-center gap-2 border-t border-[rgba(200,168,75,0.12)] pt-3">
                <span className="crown-glint text-sm">👑</span>
                <span className="font-ui truncate text-xs text-[#f0e6c8]">
                  {top.displayName}
                </span>
                <span className="ml-auto font-ui text-xs font-semibold text-[#e6c96a]">
                  +{top.amount.toLocaleString("en-US")}
                </span>
              </div>
            )}

            {pool.winners.length > 1 && (
              <p className="relative z-10 mt-2 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
                +{pool.winners.length - 1} more winner
                {pool.winners.length - 1 === 1 ? "" : "s"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
