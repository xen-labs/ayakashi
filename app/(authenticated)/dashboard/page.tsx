"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserPlus,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  Landmark,
  Home as HomeIcon,
  ShieldAlert,
} from "lucide-react";
import {
  getDashboard,
  claimDailyReward,
  getTrades,
  acceptFriendRequest,
  removeFriend,
  ApiResponseError,
} from "../../../lib/api";
import type {
  DashboardResponse,
  DashboardTransaction,
  Trade,
} from "../../../lib/api";
import { CurrencyIcon } from "../../components/CurrencyIcon";

function fmt(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function fmtMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtMs(ms: number): string {
  if (ms <= 0) return "Ready";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Live countdown — ticks locally between polls, same pattern as
// the Bank & Vault page's interest-claim timer.
function useCountdown(remainingMs: number) {
  const [ms, setMs] = useState(remainingMs);
  useEffect(() => {
    setMs(remainingMs);
  }, [remainingMs]);
  useEffect(() => {
    if (ms <= 0) return;
    const t = setInterval(() => setMs((m) => Math.max(0, m - 1000)), 1000);
    return () => clearInterval(t);
  }, [ms > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return ms;
}

// ── Currency chip — flat, no medallion/frame, just a clean stat block ──
function CurrencyChip({
  type,
  label,
  value,
  sub,
}: {
  type: "ryo" | "kitsu" | "bank";
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="form-card group flex items-center gap-3 border p-4 transition-colors hover:border-[rgba(200,168,75,0.40)]">
      <CurrencyIcon type={type} size={30} />
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-xl font-bold tabular-nums text-[#e6c96a]">
          {value}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
          {label}
          {sub ? ` · ${sub}` : ""}
        </span>
      </div>
    </div>
  );
}

// ── Transaction row ──────────────────────────────────────────────
function TxRow({ tx }: { tx: DashboardTransaction }) {
  const positive = tx.amount >= 0;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[rgba(200,168,75,0.08)] py-3 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-[#f0e6c8]">
          {tx.description}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
          {tx.location}
          <span className="mx-1.5 opacity-50">·</span>
          {new Date(tx.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <span
        className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-bold tabular-nums ${
          positive
            ? "border-green-500/25 text-green-400"
            : "border-red-500/25 text-red-400"
        }`}
      >
        {positive ? "+" : ""}
        {fmt(tx.amount)}
        <CurrencyIcon type={tx.currency} size={13} />
      </span>
    </div>
  );
}

// ── Pending friend request row ────────────────────────────────────
function FriendRequestRow({
  jid,
  username,
  displayName,
  avatarUrl,
  onSettled,
}: {
  jid: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  onSettled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    if (!username) return; // no username to route the accept/decline call by
    setBusy(true);
    try {
      await fn();
      onSettled();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[rgba(200,168,75,0.12)] bg-white/[0.02] p-3">
      <Link
        href={username ? `/profile/${username}` : "#"}
        className="flex min-w-0 items-center gap-2.5"
      >
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[rgba(200,168,75,0.1)]">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[rgba(200,168,75,0.5)]">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <span className="truncate text-sm font-bold text-[#f0e6c8]">
          {displayName}
        </span>
      </Link>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          disabled={busy || !username}
          onClick={() => act(() => acceptFriendRequest(username!))}
          className="rounded-md border border-ayakashi-gold bg-ayakashi-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:brightness-110 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy || !username}
          onClick={() => act(() => removeFriend(username!))}
          className="rounded-md border border-[rgba(200,168,75,0.25)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)] transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

// ── Pending trade offer row ───────────────────────────────────────
function TradeOfferRow({ trade }: { trade: Trade }) {
  const other = trade.initiator; // recipient is always "me" for this list — see fetch filter below
  const offerSize =
    other.offer.cardInstanceIds.length +
    other.offer.materials.length +
    (other.offer.currency ? 1 : 0);
  return (
    <Link
      href={`/trade?open=${trade._id}`}
      className="flex items-center justify-between gap-3 rounded-md border border-[rgba(200,168,75,0.12)] bg-white/[0.02] p-3 transition-colors hover:border-ayakashi-gold/40"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[rgba(200,168,75,0.1)]">
          {other.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={other.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[rgba(200,168,75,0.5)]">
              {other.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#f0e6c8]">
            {other.displayName}
          </p>
          <p className="text-[10px] text-[rgba(200,168,75,0.40)]">
            {offerSize} item{offerSize !== 1 ? "s" : ""} offered
          </p>
        </div>
      </div>
      <span className="shrink-0 rounded-md border border-ayakashi-gold/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ayakashi-gold">
        Review
      </span>
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(false);
  const [pendingTrades, setPendingTrades] = useState<Trade[]>([]);

  const load = useCallback(
    async (page = 1) => {
      if (page === 1) setLoading(true);
      else setTxLoading(true);
      setError("");
      try {
        const res = await getDashboard(page);
        setData(res);
      } catch (err) {
        if (err instanceof ApiResponseError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Couldn't load your dashboard. Try refreshing.");
      } finally {
        setLoading(false);
        setTxLoading(false);
      }
    },
    [router],
  );

  const loadTrades = useCallback(async () => {
    try {
      const res = await getTrades("pending");
      // Only offers where I'm the recipient need action from me — ones I
      // sent are already "waiting on them", nothing to do here.
      const me = data?.identity.username;
      setPendingTrades(res.trades.filter((t) => t.recipient.username === me));
    } catch {
      /* noop */
    }
  }, [data?.identity.username]);

  useEffect(() => {
    load(1);
  }, [load]);
  useEffect(() => {
    if (data) loadTrades();
  }, [data, loadTrades]);

  const handlePageChange = (p: number) => {
    setTxPage(p);
    load(p);
  };

  const dailyRemaining = useCountdown(data?.dailyClaim.remainingMs ?? 0);
  const [claimBurst, setClaimBurst] = useState(false);

  const handleClaimDaily = useCallback(async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimMessage(null);
    try {
      const result = await claimDailyReward();
      if (result.ok) {
        setClaimBurst(true);
        setTimeout(() => setClaimBurst(false), 900);
        setClaimMessage(
          result.milestoneLabel ??
            `+${result.ryo + result.bonusRyo} ryo, +${result.kitsu + result.bonusKitsu} kitsu`,
        );
        await load(txPage);
      }
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setClaimMessage("Couldn't claim right now. Try again.");
    } finally {
      setClaiming(false);
    }
  }, [claiming, load, router, txPage]);

  if (loading)
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
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
        <p className="text-sm text-[rgba(200,168,75,0.60)]">
          {error || "Something went wrong."}
        </p>
        <button
          type="button"
          onClick={() => load(1)}
          className="brush-btn w-48"
        >
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
    transactions,
    pendingFriendRequests,
  } = data;
  const totalNotifications = pendingFriendRequests.count + pendingTrades.length;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Welcome ── */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-[#f0e6c8] sm:text-3xl">
          Welcome back,{" "}
          <span className="text-ayakashi-gold">{identity.displayName}</span>
        </h1>
        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
          @{identity.username}
          <span className="h-1 w-1 rounded-full bg-[rgba(200,168,75,0.30)]" />
          Joined {fmtMemberSince(identity.memberSince)}
        </p>
      </div>

      {/* ── Notification strip — pending friends + trades, only if there's something to act on ── */}
      {totalNotifications > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pendingFriendRequests.count > 0 && (
            <div className="form-card flex flex-col gap-3 border p-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-ayakashi-gold" />
                <h2 className="font-display text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
                  Friend Requests
                </h2>
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-ayakashi-gold px-1.5 text-[10px] font-bold text-black">
                  {pendingFriendRequests.count}
                </span>
              </div>
              <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                {pendingFriendRequests.requests.map((r) => (
                  <FriendRequestRow
                    key={r.jid}
                    {...r}
                    onSettled={() => load(txPage)}
                  />
                ))}
              </div>
            </div>
          )}

          {pendingTrades.length > 0 && (
            <div className="form-card flex flex-col gap-3 border p-4">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-ayakashi-gold" />
                <h2 className="font-display text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
                  Trade Offers
                </h2>
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-ayakashi-gold px-1.5 text-[10px] font-bold text-black">
                  {pendingTrades.length}
                </span>
              </div>
              <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                {pendingTrades.map((t) => (
                  <TradeOfferRow key={t._id} trade={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Wallet — pocket only, bank shown as a secondary line, no medallion frames ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <CurrencyChip type="ryo" label="Ryo" value={fmt(currency.ryo)} />
        <CurrencyChip type="kitsu" label="Kitsu" value={fmt(currency.kitsu)} />
      </div>

      {/* ── Bank + Vault glance — thin summary, deep-links to the real management page ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/bank-vault"
          className="form-card flex items-center gap-3 border p-4 transition-colors hover:border-ayakashi-gold/40"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(200,168,75,0.25)] bg-black/40 text-ayakashi-gold">
            <Landmark className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-base font-bold tabular-nums text-[#e6c96a]">
              {fmt(currency.bank)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
              Bank · cap {fmt(currency.bankCap)}
            </span>
          </div>
        </Link>

        {vault ? (
          <Link
            href="/bank-vault"
            className="form-card flex items-center gap-3 border p-4 transition-colors hover:border-ayakashi-gold/40"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-black/40 ${
                vault.health < vault.maxHealth * 0.3
                  ? "border-red-500/40 text-red-400"
                  : "border-[rgba(200,168,75,0.25)] text-ayakashi-gold"
              }`}
            >
              <HomeIcon className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-display text-base font-bold tabular-nums text-[#e6c96a]">
                {fmt(vault.ryo)}{" "}
                <span className="text-xs font-normal text-[rgba(200,168,75,0.45)]">
                  ryo
                </span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                Home Vault Tier {vault.tier} · {vault.health}/{vault.maxHealth}{" "}
                HP
              </span>
            </div>
            {vault.repairCost && (
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
            )}
          </Link>
        ) : (
          <Link
            href="/shop"
            className="form-card flex items-center gap-3 border border-dashed p-4 text-[rgba(200,168,75,0.40)] transition-colors hover:border-ayakashi-gold/40 hover:text-ayakashi-gold"
          >
            <HomeIcon className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">
              No Home Vault — buy one from the Shop
            </span>
          </Link>
        )}
      </div>

      {/* ── Progression + Daily Claim ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="form-card flex flex-col gap-4 border p-5">
          <h2 className="font-display text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
            Progression
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-md border border-[rgba(200,168,75,0.12)] bg-black/30 p-3">
              <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                Level
              </span>
              <span className="text-xl font-bold text-[#e6c96a]">
                {progression.level}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-md border border-[rgba(200,168,75,0.12)] bg-black/30 p-3">
              <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                Cards Owned
              </span>
              <span className="text-xl font-bold text-[#f0e6c8]">
                {fmt(cardsOwned)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
              <span>Experience</span>
              <span>{fmt(progression.xp)} XP</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(200,168,75,0.10)]">
              <div
                className="h-full rounded-full bg-ayakashi-gold shadow-[0_0_6px_rgba(200,168,75,0.5)]"
                style={{
                  width: `${Math.min(100, (progression.xp % 1000) / 10)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div
          className={`form-card flex flex-col gap-4 border p-5 transition-all ${claimBurst ? "reveal-pop" : ""}`}
        >
          <h2 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
            <Flame
              className={`h-3.5 w-3.5 ${claimBurst ? "reveal-glow-pulse text-green-400" : ""}`}
            />{" "}
            Daily Claim
          </h2>
          <div
            className={`flex items-center justify-between rounded-md border p-4 transition-colors ${
              dailyClaim.available
                ? "border-green-500/30 bg-green-500/5"
                : "border-[rgba(200,168,75,0.12)] bg-black/30"
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                Streak
              </span>
              <span className="text-xl font-bold text-[#e6c96a]">
                {dailyClaim.currentStreak} days
              </span>
            </div>
            <button
              type="button"
              onClick={handleClaimDaily}
              disabled={!dailyClaim.available || claiming}
              className={`rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed ${
                dailyClaim.available
                  ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.40)]"
              }`}
            >
              {claiming
                ? "Claiming…"
                : dailyClaim.available
                  ? "Claim Now"
                  : fmtMs(dailyRemaining)}
            </button>
          </div>
          {claimMessage && (
            <p className="rounded-md border border-[rgba(200,168,75,0.20)] bg-black/30 py-2 text-center text-xs text-[#e6c96a]">
              {claimMessage}
            </p>
          )}
          {!dailyClaim.streakWillContinueIfClaimedNow &&
            !dailyClaim.available && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 py-2 text-center text-[10px] uppercase tracking-widest text-red-400">
                Streak at risk — claim soon
              </p>
            )}
        </div>
      </div>

      <hr className="gold-rule" />

      {/* ── Full transaction history, paginated ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#e6c96a]">
            Transaction History
          </h2>
          <span className="text-xs text-[rgba(200,168,75,0.40)]">
            {fmt(transactions.total)} total
          </span>
        </div>

        <div className="form-card border p-4">
          {txLoading ? (
            <div className="flex h-32 items-center justify-center">
              <svg
                className="h-6 w-6 animate-spin text-ayakashi-gold"
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
          ) : transactions.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-[rgba(200,168,75,0.40)]">
              No transactions yet.
            </p>
          ) : (
            transactions.items.map((tx, i) => <TxRow key={i} tx={tx} />)
          )}
        </div>

        {transactions.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={txPage <= 1}
              onClick={() => handlePageChange(txPage - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(200,168,75,0.30)] text-[rgba(200,168,75,0.65)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-[rgba(200,168,75,0.55)]">
              {txPage} / {transactions.totalPages}
            </span>
            <button
              type="button"
              disabled={txPage >= transactions.totalPages}
              onClick={() => handlePageChange(txPage + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(200,168,75,0.30)] text-[rgba(200,168,75,0.65)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
