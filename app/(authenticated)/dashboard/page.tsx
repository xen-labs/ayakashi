"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getDashboard,
  getLotteryRecentWinners,
  ApiResponseError,
} from "../../../lib/api";
import type {
  DashboardResponse,
  DashboardTransaction,
  LotteryPool,
} from "../../../lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CurrencyIcon } from "../../components/CurrencyIcon";

// Dashboard's own /dashboard route has no pagination — it always
// returns a flat top-50 slice (see RECENT_TRANSACTIONS_LIMIT in
// routes/dashboard.ts). Rather than duplicating pagination here, show
// a short preview and send anyone who wants the full paginated ledger
// to Bank & Vault (GET /bank-vault already supports ?page=N).
const DASHBOARD_TX_PREVIEW_COUNT = 5;

function formatNumber(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMs(ms: number): string {
  if (ms <= 0) return "Ready";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Recent transaction row ─────────────────────────────────────────
function TxRow({ tx }: { tx: DashboardTransaction }) {
  const positive = tx.amount >= 0;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[rgba(200,168,75,0.08)] last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-[#f0e6c8] truncate">
          {tx.description}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
          {tx.location} ·{" "}
          {new Date(tx.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
      <span
        className={`text-sm font-bold tabular-nums shrink-0 flex items-center gap-1 ${positive ? "text-green-400" : "text-red-400"}`}
      >
        {positive ? "+" : ""}
        {formatNumber(tx.amount)}
        <CurrencyIcon
          type={tx.currency === "ryo" ? "ryo" : "kitsu"}
          size={14}
        />
      </span>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lotteryPools, setLotteryPools] = useState<LotteryPool[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, lottery] = await Promise.allSettled([
        getDashboard(),
        getLotteryRecentWinners(),
      ]);
      if (res.status === "fulfilled") setData(res.value);
      else {
        if (
          res.reason instanceof ApiResponseError &&
          res.reason.status === 401
        ) {
          router.push("/login");
          return;
        }
        setError("Couldn't load your dashboard. Try refreshing.");
      }
      if (lottery.status === "fulfilled") setLotteryPools(lottery.value.pools);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
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
    );

  if (error || !data)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="theme-body text-sm">{error || "Something went wrong."}</p>
        <button type="button" onClick={load} className="brush-btn w-40">
          Retry
        </button>
      </div>
    );

  const {
    identity,
    currency,
    vault,
    progression,
    dailyClaim,
    cardsOwned,
    recentTransactions,
    pendingFriendRequests,
  } = data;

  return (
    <section className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 rounded-full bg-[rgba(200,168,75,0.04)] blur-[80px]" />

      {/* ── Welcome ── */}
      <div className="relative flex flex-col gap-1">
        <h1 className="font-display text-2xl font-black uppercase tracking-[0.05em] text-[#f0e6c8] sm:text-3xl">
          Welcome back,{" "}
          <span className="text-[#c8a84b]">{identity.displayName}</span>
        </h1>
        <p className="font-ui text-xs uppercase tracking-[0.14em] text-[rgba(200,168,75,0.40)]">
          @{identity.username} &nbsp;·&nbsp; Member since{" "}
          {formatMemberSince(identity.memberSince)}
        </p>
        <div className="mt-2 h-px w-32 bg-gradient-to-r from-[#c8a84b] to-transparent" />
      </div>

      <hr className="gold-rule" />

      {/* ── Currency grid ── */}
      <div>
        <div className="section-header mb-6">
          <span className="section-header-text">Wallet</span>
        </div>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
          {[
            {
              label: "Ryo",
              value: formatNumber(currency.ryo),
              type: "ryo" as const,
            },
            {
              label: "Kitsu",
              value: formatNumber(currency.kitsu),
              type: "kitsu" as const,
            },
            {
              label: "Bank",
              value: formatNumber(currency.bank),
              type: "bank" as const,
            },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-2">
              <div className="coin-medallion overflow-hidden">
                <CurrencyIcon
                  type={stat.type}
                  size={72}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="font-display text-lg font-bold tabular-nums text-[#e6c96a]">
                {stat.value}
              </span>
              <span className="coin-medallion-label">{stat.label}</span>
            </div>
          ))}
        </div>
        {/* Bank cap */}
        <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.30)]">
          Bank cap: {formatNumber(currency.bankCap)} &nbsp;·&nbsp; Tier{" "}
          {currency.bankVaultTier}
        </p>
      </div>

      <hr className="gold-rule" />

      {/* ── Two-col: Progression + Daily ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Progression */}
        <div className="form-card flex flex-col gap-4 border p-5">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
            Progression
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
              Level
            </span>
            <span className="text-lg font-bold text-[#e6c96a]">
              {progression.level}
            </span>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
              <span>XP</span>
              <span>{formatNumber(progression.xp)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden bg-[rgba(200,168,75,0.10)]">
              <div
                className="h-full bg-[#c8a84b]"
                style={{
                  width: `${Math.min(100, (progression.xp % 1000) / 10)}%`,
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
              Cards Owned
            </span>
            <span className="text-sm font-bold text-[#f0e6c8]">
              {formatNumber(cardsOwned)}
            </span>
          </div>
        </div>

        {/* Daily claim */}
        <div className="form-card flex flex-col gap-4 border p-5">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
            Daily Claim
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
              Status
            </span>
            <span
              className={`text-xs font-bold uppercase tracking-widest ${dailyClaim.available ? "text-green-400" : "text-[rgba(200,168,75,0.50)]"}`}
            >
              {dailyClaim.available
                ? "✦ Ready"
                : `${formatMs(dailyClaim.remainingMs)} left`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
              Streak
            </span>
            <span className="text-lg font-bold text-[#e6c96a]">
              {dailyClaim.currentStreak}d 🔥
            </span>
          </div>
          {!dailyClaim.streakWillContinueIfClaimedNow &&
            !dailyClaim.available && (
              <p className="text-[10px] text-red-400 uppercase tracking-widest">
                ⚠ Claim soon — streak at risk
              </p>
            )}
        </div>
      </div>

      {/* ── Vault (only if owned) ── */}
      {vault && (
        <>
          <hr className="gold-rule" />
          <div>
            <div className="section-header mb-6">
              <span className="section-header-text">Vault</span>
            </div>
            <div className="form-card grid grid-cols-2 gap-4 border p-5 sm:grid-cols-4">
              {[
                {
                  label: "Vault Ryo",
                  value: `${formatNumber(vault.ryo)} / ${formatNumber(vault.ryoCap)}`,
                },
                {
                  label: "Vault Kitsu",
                  value: `${formatNumber(vault.kitsu)} / ${formatNumber(vault.kitsuCap)}`,
                },
                {
                  label: "Health",
                  value: `${vault.health} / ${vault.maxHealth}`,
                },
                { label: "Tier", value: String(vault.tier) },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1 text-center"
                >
                  <span className="text-sm font-bold text-[#e6c96a]">
                    {s.value}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            {vault.repairCost && (
              <p className="mt-2 text-center text-xs text-[rgba(200,168,75,0.45)]">
                Repair: {formatNumber(vault.repairCost.ryo)} ryo +{" "}
                {vault.repairCost.materialQty}× {vault.repairCost.material}
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Pending friend requests ── */}
      {pendingFriendRequests.count > 0 && (
        <>
          <hr className="gold-rule" />
          <div className="form-card border p-5">
            <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
              Friend Requests ({pendingFriendRequests.count})
            </h2>
            <div className="flex flex-col gap-2">
              {pendingFriendRequests.requests.map((r) => (
                <div
                  key={r.jid}
                  className="flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-sm text-[#f0e6c8]">
                      {r.displayName}
                    </span>
                    {r.username && (
                      <span className="ml-1.5 text-xs text-[rgba(200,168,75,0.45)]">
                        @{r.username}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Recent transactions ── */}
      {recentTransactions.length > 0 && (
        <>
          <hr className="gold-rule" />
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="section-header !mb-0">
                <span className="section-header-text">Recent</span>
              </div>
              <Link
                href="/bank-vault"
                className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.55)] transition-colors hover:text-[#c8a84b]"
              >
                View all →
              </Link>
            </div>
            <div className="form-card border p-4">
              {recentTransactions
                .slice(0, DASHBOARD_TX_PREVIEW_COUNT)
                .map((tx, i) => (
                  <TxRow key={i} tx={tx} />
                ))}
            </div>
          </div>
        </>
      )}

      {/* ── Lottery recent winners ── */}
      {lotteryPools.length > 0 && (
        <>
          <hr className="gold-rule" />
          <div>
            <div className="section-header mb-4">
              <span className="section-header-text">Lottery</span>
            </div>
            <div className="flex flex-col gap-4">
              {lotteryPools.map((pool, pi) => (
                <div key={pi} className="form-card border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
                      {new Date(pool.resolvedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-bold text-[#e6c96a]">
                      <CurrencyIcon type="ryo" size={13} />{" "}
                      {formatNumber(pool.prizePool)} prize pool
                    </span>
                  </div>
                  {pool.winners.map((w) => (
                    <div
                      key={w.placement}
                      className="flex items-center justify-between border-b border-[rgba(200,168,75,0.08)] py-2 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {w.placement === 1
                            ? "🥇"
                            : w.placement === 2
                              ? "🥈"
                              : "🥉"}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-[#f0e6c8]">
                            {w.displayName}
                          </span>
                          {w.username && (
                            <span className="ml-1.5 text-xs text-[rgba(200,168,75,0.40)]">
                              @{w.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-bold text-green-400">
                        +{formatNumber(w.amount)}{" "}
                        <CurrencyIcon type="ryo" size={13} />
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
