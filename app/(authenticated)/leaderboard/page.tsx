"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { getLeaderboard, ApiResponseError } from "../../../lib/api";
import type { LeaderboardMetric, LeaderboardResponse } from "../../../lib/api";
import { AvatarWithFrame } from "../../components/AvatarWithFrame";
import { CurrencyIcon } from "../../components/CurrencyIcon";
import { FireSpinner } from "../../components/FireSpinner";

type LeaderboardRow = LeaderboardResponse["items"][number];
type PodiumRow = LeaderboardRow & { formattedValue: string };

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

// Podium pedestal heights + entrance delay, tallest (1st) rising last
// so the eye settles on the winner — same trick real award-ceremony
// staging uses.
const PODIUM_CONFIG: Record<
  number,
  { height: string; order: string; delay: string; avatarSize: number }
> = {
  1: {
    height: "h-28 sm:h-36",
    order: "order-2",
    delay: "300ms",
    avatarSize: 102,
  },
  2: {
    height: "h-20 sm:h-28",
    order: "order-1",
    delay: "150ms",
    avatarSize: 82,
  },
  3: {
    height: "h-16 sm:h-20",
    order: "order-3",
    delay: "150ms",
    avatarSize: 82,
  },
};

function formatValue(value: number, metric: LeaderboardMetric): string {
  if (metric === "cards") return value.toLocaleString("en-US");
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

function RowAvatar({ row, size }: { row: LeaderboardRow; size: number }) {
  // [FIXED — this pass] Previously only composed AvatarWithFrame (with
  // a hardcoded default frame) when avatarUrl was MISSING — a row with
  // a real avatar rendered a bare <Image> in a manually-drawn gold
  // ring, showing no actual equipped frame at all. Now always goes
  // through AvatarWithFrame with the row's real avatarUrl/frameUrl
  // (both resolved server-side in leaderboard.ts), falling back to the
  // defaults only when the row itself has none.
  //
  // [CHANGED] The old manual ring/border wrapper (and its `ring` prop)
  // is gone per product decision — a player's real equipped frame is
  // now the only ring shown, rather than layering a generic UI ring
  // behind/around it. AvatarWithFrame's frame image renders ~1.35x
  // larger than innerSize (see that component's own comment), so
  // innerSize is sized down here to size/1.35 to make the FRAME's
  // outer edge land on `size`, not the inner avatar circle — otherwise
  // rank-1's frame would visibly overflow its podium slot.
  return (
    <AvatarWithFrame
      avatarSrc={
        row.avatarUrl || "/user-profile/user-profile/default-avatar.webp"
      }
      frameSrc={
        row.frameUrl || "/user-profile/user-profile/default-avatar-frame.webp"
      }
      innerSize={Math.round(size / 1.35)}
      alt={row.displayName}
    />
  );
}

// ── Podium — top 3, staged like an awards ceremony ──────────────────
// [NEW] Rank 1 gets two extra always-on ambient layers behind/around
// the avatar: a dashed rune ring drifting one direction (14s) and a
// two-point "comet + trailing spark" pair orbiting the other direction
// (6s). The periods are deliberately mismatched (6s vs 14s share no
// short common cycle) so the whole thing keeps looking slightly
// different lap to lap instead of reading as one obvious spinning
// sprite — the kind of ambient motion that rewards someone who just
// sits and watches the page for a few seconds, rather than a one-shot
// flourish that plays once on load and goes still.
function Podium({ rows }: { rows: PodiumRow[] }) {
  const byRank = new Map<number, PodiumRow>(rows.map((r) => [r.rank, r]));
  const ranks = [1, 2, 3].filter((r) => byRank.has(r));
  if (ranks.length === 0) return null;

  return (
    <div className="glass-panel relative flex flex-col items-center gap-0 overflow-visible rounded-2xl border px-4 pb-0 pt-9 sm:px-8 sm:pt-10">
      {/* [FIXED — this pass] The panel was overflow-hidden with only
          pt-4 above a crown sitting at -top-7/-top-8 (i.e. ~28-32px
          above the avatar) — the rounded top edge + hidden overflow
          clipped the crown's tip. Switched to overflow-visible (nothing
          else in this card relies on clipping — the gradient below is
          purely additive) and gave the panel enough top padding
          (pt-9/pt-10) that the crown has real room even before the
          overflow fix, so it's not depending on either change alone. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-2xl bg-gradient-to-b from-[rgba(200,168,75,0.10)] to-transparent" />

      <div className="relative flex w-full items-end justify-center gap-3 sm:gap-6">
        {ranks.map((rank) => {
          const row = byRank.get(rank)!;
          const cfg = PODIUM_CONFIG[rank];
          const isChampion = rank === 1;
          return (
            <div
              key={row.jid}
              className={`podium-rise flex flex-1 flex-col items-center gap-2 ${cfg.order}`}
              style={{ animationDelay: cfg.delay }}
            >
              {/* Avatar + crown/medal */}
              <div className="relative flex flex-col items-center">
                {isChampion && (
                  <>
                    {/* [CHANGED] Crown sized down (h-7/w-7 -> h-5/w-5,
                        sm:h-8/w-8 -> sm:h-6/w-6) to make room for the
                        larger avatar below it without the two crowding
                        each other. */}
                    <Crown
                      className="crown-glint absolute -top-4 h-5 w-5 text-[#FFD700] sm:-top-5 sm:h-6 sm:w-6"
                      fill="currentColor"
                    />
                    {/* Rising embers — random-feeling x-offset/delay/
                        duration per spark, drifting straight up and
                        fading. No geometric ring, nothing traces a
                        visible line. */}
                    <span className="leader-champion-embers">
                      <span
                        style={
                          {
                            "--ember-x": "20%",
                            "--ember-drift": "-8px",
                            "--ember-delay": "0s",
                            "--ember-duration": "3.1s",
                          } as React.CSSProperties
                        }
                      />
                      <span
                        style={
                          {
                            "--ember-x": "68%",
                            "--ember-drift": "10px",
                            "--ember-delay": "0.9s",
                            "--ember-duration": "3.6s",
                          } as React.CSSProperties
                        }
                      />
                      <span
                        style={
                          {
                            "--ember-x": "42%",
                            "--ember-drift": "-4px",
                            "--ember-delay": "1.7s",
                            "--ember-duration": "2.9s",
                          } as React.CSSProperties
                        }
                      />
                      <span
                        style={
                          {
                            "--ember-x": "85%",
                            "--ember-drift": "6px",
                            "--ember-delay": "2.4s",
                            "--ember-duration": "3.3s",
                          } as React.CSSProperties
                        }
                      />
                      <span
                        style={
                          {
                            "--ember-x": "8%",
                            "--ember-drift": "9px",
                            "--ember-delay": "3.2s",
                            "--ember-duration": "3.8s",
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    {/* [REMOVED — this pass] .leader-champion-comet used
                        to render here: a bright dot with a trailing
                        box-shadow streak, animated in an orbital path
                        via comet-streak. Per explicit feedback ("the
                        straight line that moves in kinda circular
                        motion... remove that") — the embers above are
                        the only champion-only ambient effect left. */}
                  </>
                )}
                <span
                  className="leader-podium-glow"
                  style={
                    { "--podium-color": RANK_GLOW[rank] } as React.CSSProperties
                  }
                />
                <RowAvatar row={row} size={cfg.avatarSize} />
                <span className="absolute -bottom-1.5 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-black bg-[#0d0c00] text-sm">
                  {RANK_MEDAL[rank]}
                </span>
              </div>

              <Link
                href={row.username ? `/profile/${row.username}` : "#"}
                className="max-w-[90px] truncate text-center text-xs font-bold text-[#f0e6c8] transition-colors hover:text-ayakashi-gold sm:max-w-[120px] sm:text-sm"
              >
                {row.displayName}
              </Link>
              <span
                className={`flex items-center gap-1 text-xs font-bold tabular-nums sm:text-sm ${RANK_COLORS[rank]}`}
              >
                {/* metric-specific icon injected by parent via row.value formatting */}
                {row.formattedValue}
              </span>

              {/* Pedestal */}
              <div
                className={`mt-2 flex w-full items-start justify-center rounded-t-lg border-t border-x pt-2 ${cfg.height} ${
                  rank === 1
                    ? "border-[rgba(255,215,0,0.35)] bg-gradient-to-b from-[rgba(255,215,0,0.12)] to-transparent"
                    : rank === 2
                      ? "border-[rgba(192,192,192,0.3)] bg-gradient-to-b from-[rgba(192,192,192,0.08)] to-transparent"
                      : "border-[rgba(205,127,50,0.3)] bg-gradient-to-b from-[rgba(205,127,50,0.08)] to-transparent"
                }`}
              >
                <span
                  className={`font-display text-2xl font-bold sm:text-4xl ${RANK_COLORS[rank]}`}
                >
                  {rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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

  const isFirstPage = page === 1;
  const podiumRows = isFirstPage
    ? (data?.items.filter((r) => r.rank <= 3) ?? [])
    : [];
  const listRows = isFirstPage
    ? (data?.items.filter((r) => r.rank > 3) ?? [])
    : (data?.items ?? []);

  // The podium needs a pre-formatted value string (with currency icon
  // context baked in isn't possible through a plain string, so we
  // attach a JSX-safe formatted string via toLocaleString + metric
  // label — icons for ryo/kitsu are rendered inline in the list rows
  // instead, where a single line has more room).
  const withFormatted = podiumRows.map((r) => ({
    ...r,
    formattedValue: formatValue(r.value, metric),
  }));

  return (
    <div className="relative overflow-hidden">
      {/* ── Ambient background auras ── */}
      <div className="ambient-glow-a -left-24 -top-16" />
      <div className="ambient-glow-b -right-16 top-80" />

      <section className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="stagger-in section-header">
          <span className="section-header-text">Leaderboard</span>
        </div>

        <hr className="gold-rule" />

        {/* ── Metric tabs ── */}
        <div
          className="stagger-in flex gap-0 border-b border-[rgba(200,168,75,0.15)]"
          style={{ animationDelay: "60ms" }}
        >
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

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <FireSpinner size={32} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-sm text-[rgba(200,168,75,0.50)]">{error}</p>
            <button
              type="button"
              onClick={() => load(metric, page)}
              className="h-9 rounded-md border border-[#c8a84b] px-6 text-xs font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ── Podium — top 3, only on page 1 ── */}
            {withFormatted.length > 0 && (
              <div
                key={metric}
                className="stagger-in"
                style={{ animationDelay: "100ms" }}
              >
                <Podium rows={withFormatted} />
              </div>
            )}

            {/* ── Ranked list, 4+ (or full list on later pages) ── */}
            <div className="glass-panel flex flex-col rounded-xl border px-2">
              {listRows.length === 0 && podiumRows.length === 0 && (
                <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
                  Nobody here yet.
                </p>
              )}
              {listRows.map((row, i) => {
                const isTop3 = row.rank <= 3;
                return (
                  <div
                    key={row.jid}
                    className={`leader-row-in group flex items-center gap-3 overflow-hidden border-b border-[rgba(200,168,75,0.08)] px-2 py-3 transition-all last:border-0 hover:bg-[rgba(200,168,75,0.04)] ${isTop3 ? "rank-row-glow" : ""}`}
                    style={
                      {
                        animationDelay: `${Math.min(i, 12) * 30}ms`,
                        ...(isTop3
                          ? { "--row-glow-color": RANK_GLOW[row.rank] }
                          : {}),
                      } as React.CSSProperties
                    }
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

                    <RowAvatar row={row} size={36} />

                    {/* Name + username */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0">
                      <Link
                        href={row.username ? `/profile/${row.username}` : "#"}
                        className="truncate text-sm font-bold text-[#f0e6c8] transition-colors hover:text-[#c8a84b]"
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
                      className={`number-tick flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums ${isTop3 ? (RANK_COLORS[row.rank] ?? "text-[#e6c96a]") : "text-[#e6c96a]"}`}
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
                  className="h-9 rounded-md border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-all hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
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
                  className="h-9 rounded-md border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-all hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
