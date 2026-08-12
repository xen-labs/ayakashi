"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeaderboard, ApiResponseError } from "../../../lib/api";
import type { LeaderboardMetric, LeaderboardResponse } from "../../../lib/api";
import { AvatarWithFrame } from "../../components/AvatarWithFrame";
import { CurrencyIcon } from "../../components/CurrencyIcon";

const TABS: { id: LeaderboardMetric; label: string; icon: React.ReactNode }[] =
  [
    { id: "xp", label: "XP", icon: "⭐" },
    { id: "ryo", label: "Ryo", icon: <CurrencyIcon type="ryo" size={16} /> },
    {
      id: "kitsu",
      label: "Kitsu",
      icon: <CurrencyIcon type="kitsu" size={16} />,
    },
    { id: "cards", label: "Cards", icon: "🃏" },
  ];

const RANK_COLORS: Record<number, string> = {
  1: "text-[#FFD700]",
  2: "text-[#C0C0C0]",
  3: "text-[#CD7F32]",
};

const RANK_MEDAL: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

// Podium glow tint per rank — used as the --podium-color custom
// property on .leader-podium-glow, so the ambient pulse behind each
// medal matches its own metal rather than one flat gold for all three.
const RANK_GLOW: Record<number, string> = {
  1: "rgba(255, 215, 0, 0.45)",
  2: "rgba(192, 192, 192, 0.4)",
  3: "rgba(205, 127, 50, 0.4)",
};

function formatValue(value: number, metric: LeaderboardMetric): string {
  if (metric === "cards") return value.toLocaleString("en-US");
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

export default function Leaderboard() {
  const router = useRouter();
  const [metric, setMetric] = useState<LeaderboardMetric>("xp");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (m: LeaderboardMetric, p: number) => {
      setLoading(true);
      setError("");
      try {
        const res = await getLeaderboard(m, p);
        setData(res);
      } catch (err) {
        if (err instanceof ApiResponseError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Couldn't load leaderboard. Try refreshing.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    load(metric, page);
  }, [load, metric, page]);

  const switchTab = (m: LeaderboardMetric) => {
    setMetric(m);
    setPage(1);
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="section-header [animation:shop-card-in_0.3s_ease-out_backwards]">
        <span className="section-header-text">Leaderboard</span>
      </div>

      <hr className="gold-rule" />

      {/* ── Metric tabs ── */}
      <div className="flex gap-0 border-b border-[rgba(200,168,75,0.15)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`relative flex flex-1 flex-col items-center gap-1 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.14em] transition-all sm:flex-row sm:justify-center sm:gap-1.5 sm:text-xs ${
              metric === t.id
                ? "text-[#c8a84b]"
                : "text-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.70)]"
            }`}
          >
            <span className="transition-transform group-hover:scale-110">
              {t.icon}
            </span>
            <span>{t.label}</span>
            {metric === t.id && (
              <span className="leader-tab-underline absolute bottom-0 left-0 h-0.5 w-full bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-ayakashi-gold"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-sm text-[rgba(200,168,75,0.50)]">{error}</p>
          <button
            type="button"
            onClick={() => load(metric, page)}
            className="h-9 border border-[#c8a84b] px-6 text-xs font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            {data?.items.map((row, i) => {
              const isTop3 = row.rank <= 3;
              return (
                <div
                  key={row.jid}
                  className={`leader-row-in group flex items-center gap-3 border-b border-[rgba(200,168,75,0.08)] px-2 py-3 transition-all last:border-0 hover:bg-[rgba(200,168,75,0.04)] ${isTop3 ? "bg-[rgba(200,168,75,0.03)] hover:-translate-y-0.5" : ""}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                >
                  {/* Rank */}
                  <div className="relative w-8 shrink-0 text-center">
                    {isTop3 && (
                      <span
                        className="leader-podium-glow"
                        style={
                          {
                            "--podium-color": RANK_GLOW[row.rank],
                          } as React.CSSProperties
                        }
                      />
                    )}
                    {RANK_MEDAL[row.rank] ? (
                      <span className="relative text-xl transition-transform group-hover:scale-110">
                        {RANK_MEDAL[row.rank]}
                      </span>
                    ) : (
                      <span
                        className={`relative text-sm font-bold tabular-nums ${RANK_COLORS[row.rank] ?? "text-[rgba(200,168,75,0.40)]"}`}
                      >
                        {row.rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full border bg-[rgba(200,168,75,0.05)] transition-transform group-hover:scale-105 ${isTop3 ? "border-[rgba(200,168,75,0.45)] shadow-[0_0_10px_rgba(200,168,75,0.2)]" : "border-[rgba(200,168,75,0.20)]"}`}
                  >
                    {row.avatarUrl ? (
                      <Image
                        src={row.avatarUrl}
                        alt={row.displayName}
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <AvatarWithFrame
                        avatarSrc="/user-profile/user-profile/default-avatar.webp"
                        frameSrc="/user-profile/user-profile/default-avatar-frame.webp"
                        innerSize={22}
                      />
                    )}
                  </div>

                  {/* Name + username */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0">
                    <Link
                      href={row.username ? `/profile/${row.username}` : "#"}
                      className="truncate text-sm font-bold text-[#f0e6c8] hover:text-[#c8a84b] transition-colors"
                    >
                      {row.displayName}
                    </Link>
                    {row.username && (
                      <span className="text-[10px] text-[rgba(200,168,75,0.40)]">
                        @{row.username}
                        {metric === "xp" && row.level != null && (
                          <span className="ml-1.5">· Lv {row.level}</span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Value */}
                  <span
                    key={`${row.jid}-${row.value}`}
                    className={`number-tick shrink-0 flex items-center gap-1 text-sm font-bold tabular-nums ${isTop3 ? (RANK_COLORS[row.rank] ?? "text-[#e6c96a]") : "text-[#e6c96a]"}`}
                  >
                    {(metric === "ryo" || metric === "kitsu") && (
                      <CurrencyIcon type={metric} size={14} />
                    )}
                    {formatValue(row.value, metric)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ── */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-all hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              >
                ← Prev
              </button>
              <span className="text-xs text-[rgba(200,168,75,0.40)]">
                Page {data.page} / {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
                className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-all hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
