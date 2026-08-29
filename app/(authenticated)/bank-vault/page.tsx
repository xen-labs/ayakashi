"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    Landmark,
    Home as HomeIcon,
    ShieldAlert,
    ArrowDownToLine,
    ArrowUpFromLine,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    Lock,
    Wrench
} from "lucide-react";
import {
    getBankVault,
    openBankAccount,
    depositBank,
    withdrawBank,
    claimBankInterest,
    upgradeBank,
    upgradeVault,
    repairVault,
    ApiResponseError
} from "../../../lib/api";
import type { BankVaultResponse, BankVaultTransaction } from "../../../lib/api";
import { CurrencyIcon } from "../../components/CurrencyIcon";

function fmt(n: number | undefined | null): string {
    if (n == null) return "—";
    return n.toLocaleString("en-US");
}

function fmtMs(ms: number): string {
    if (ms <= 0) return "Ready";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

const QUICK_PERCENTS = [25, 50, 75, 100];

// ── Live countdown — ticks locally between polls so "Ready" appears
// exactly on time instead of waiting for the next full data refresh.
function useCountdown(remainingMs: number) {
    const [ms, setMs] = useState(remainingMs);
    useEffect(() => {
        setMs(remainingMs);
    }, [remainingMs]);
    useEffect(() => {
        if (ms <= 0) return;
        const t = setInterval(() => setMs(m => Math.max(0, m - 1000)), 1000);
        return () => clearInterval(t);
    }, [ms > 0]); // eslint-disable-line react-hooks/exhaustive-deps
    return ms;
}

// ── Health bar — color shifts gold -> amber -> red as it drops ──────
function HealthBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const color =
        pct > 60
            ? "bg-ayakashi-gold"
            : pct > 30
              ? "bg-amber-500"
              : "bg-red-500";
    const glow =
        pct > 60
            ? "shadow-[0_0_8px_rgba(200,168,75,0.5)]"
            : pct > 30
              ? "shadow-[0_0_8px_rgba(245,158,11,0.5)]"
              : "shadow-[0_0_10px_rgba(239,68,68,0.6)]";
    return (
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/50">
            <div
                className={`h-full rounded-full transition-all duration-700 ${color} ${glow}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ── Fill bar — cap progress ──────────────────────────────────────
function FillBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(200,168,75,0.10)]">
            <div
                className="h-full rounded-full bg-ayakashi-gold transition-all duration-700"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ── Bank hero panel — points at /assets/webapp/vault/bank.webp (same
// asset the Upgrade page's Bank card uses — one shared file, one shared
// concept). Falls back to the icon + ray-sweep/coin-drift treatment via
// onError so nothing breaks before that file exists. ──────────────────
function BankHero() {
    const [broken, setBroken] = useState(false);
    return (
        <div className="hero-panel group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-t-xl border-b border-[rgba(200,168,75,0.15)] bg-[radial-gradient(circle_at_50%_40%,rgba(200,168,75,0.14),transparent_70%)]">
            {!broken && (
                <Image
                    src="/assets/webapp/vault/bank.webp"
                    alt="Bank"
                    fill
                    className="relative z-10 object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    unoptimized
                    onError={() => setBroken(true)}
                />
            )}
            {broken && (
                <>
                    <div className="hero-ray-sweep absolute inset-0 opacity-40" />
                    <div className="coin-float relative flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(200,168,75,0.35)] bg-black/50 shadow-[0_0_30px_rgba(200,168,75,0.25)] transition-transform duration-500 group-hover:scale-110">
                        <Landmark className="h-9 w-9 text-ayakashi-gold" />
                    </div>
                    <span
                        className="coin-drift absolute left-[22%] top-[65%] text-lg opacity-70"
                        style={{ animationDelay: "0s" }}
                    >
                        🪙
                    </span>
                    <span
                        className="coin-drift absolute right-[24%] top-[70%] text-sm opacity-60"
                        style={{ animationDelay: "1.1s" }}
                    >
                        🪙
                    </span>
                    <span
                        className="coin-drift absolute left-[48%] top-[75%] text-xs opacity-50"
                        style={{ animationDelay: "2.2s" }}
                    >
                        🪙
                    </span>
                </>
            )}
        </div>
    );
}

// ── Vault hero panel — points at /assets/webapp/vault/home_vault.webp,
// swapping to home_vault_critical.webp when vault health is low (same
// two files the Upgrade page's Vault card uses). Unowned vault stays
// icon-only dimmed/locked since there's nothing to show yet. ──────────
function VaultHero({ critical, owned }: { critical: boolean; owned: boolean }) {
    const [broken, setBroken] = useState(false);
    const [criticalBroken, setCriticalBroken] = useState(false);

    if (!owned) {
        return (
            <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-t-xl border-b border-[rgba(200,168,75,0.12)] bg-[rgba(200,168,75,0.03)] opacity-50">
                <HomeIcon className="h-12 w-12 text-[rgba(200,168,75,0.30)]" />
            </div>
        );
    }

    const useCriticalImg = critical && !criticalBroken;
    const imgSrc = useCriticalImg
        ? "/assets/webapp/vault/home_vault_critical.webp"
        : "/assets/webapp/vault/home_vault.webp";
    const imgIsBroken = useCriticalImg ? false : broken;

    return (
        <div
            className={`hero-panel group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-t-xl border-b transition-colors duration-500 ${
                critical
                    ? "border-red-500/25 bg-[radial-gradient(circle_at_50%_40%,rgba(220,60,60,0.16),transparent_70%)] vault-danger-breathe"
                    : "border-[rgba(200,168,75,0.15)] bg-[radial-gradient(circle_at_50%_40%,rgba(200,168,75,0.14),transparent_70%)]"
            }`}
        >
            {!imgIsBroken && (
                <Image
                    src={imgSrc}
                    alt="Home Vault"
                    fill
                    className={`relative z-10 object-cover transition-transform duration-500 group-hover:scale-[1.05] ${critical ? "brightness-90" : ""}`}
                    unoptimized
                    onError={() =>
                        useCriticalImg
                            ? setCriticalBroken(true)
                            : setBroken(true)
                    }
                />
            )}
            {critical && (
                <div className="pointer-events-none absolute inset-0 z-20 bg-red-500/10" />
            )}
            {imgIsBroken && (
                <div
                    className={`hero-ray-sweep absolute inset-0 opacity-40 ${critical ? "hero-ray-sweep-danger" : ""}`}
                />
            )}
            {imgIsBroken && (
                <div
                    className={`relative flex h-20 w-20 items-center justify-center rounded-full border transition-transform duration-500 group-hover:scale-110 ${
                        critical
                            ? "border-red-500/40 bg-black/50 shadow-[0_0_30px_rgba(220,60,60,0.30)] reveal-glow-pulse"
                            : "border-[rgba(200,168,75,0.35)] bg-black/50 shadow-[0_0_30px_rgba(200,168,75,0.25)]"
                    }`}
                >
                    <HomeIcon
                        className={`h-9 w-9 ${critical ? "text-red-400" : "text-ayakashi-gold"}`}
                    />
                </div>
            )}
            {critical && (
                <>
                    <span className="vault-spark absolute left-[30%] top-[35%] z-20 h-1 w-1 rounded-full bg-red-400" />
                    <span
                        className="vault-spark absolute right-[28%] top-[55%] z-20 h-1 w-1 rounded-full bg-red-400"
                        style={{ animationDelay: "0.6s" }}
                    />
                </>
            )}
        </div>
    );
}

// ── Deposit/Withdraw quick-amount panel ──────────────────────────
function AmountPanel({
    max,
    onSubmit,
    submitLabel,
    busy,
    accent
}: {
    max: number;
    onSubmit: (amount: number) => void;
    submitLabel: string;
    busy: boolean;
    accent: "gold" | "red";
}) {
    const [value, setValue] = useState("");
    const numeric = Math.floor(Number(value) || 0);
    const valid = numeric > 0 && numeric <= max;

    const accentClasses =
        accent === "gold"
            ? "border-ayakashi-gold text-ayakashi-gold hover:bg-ayakashi-gold hover:text-black"
            : "border-red-500 text-red-400 hover:bg-red-500 hover:text-black";

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    inputMode="numeric"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="Amount"
                    className="form-input h-10 flex-1 border px-3 text-sm outline-none"
                />
                <button
                    type="button"
                    disabled={max <= 0}
                    onClick={() => setValue(String(max))}
                    className="h-10 shrink-0 rounded-md border border-[rgba(200,168,75,0.30)] px-3 text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:opacity-30"
                >
                    Max
                </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
                {QUICK_PERCENTS.map(p => (
                    <button
                        key={p}
                        type="button"
                        disabled={max <= 0}
                        onClick={() =>
                            setValue(String(Math.floor((max * p) / 100)))
                        }
                        className="h-8 rounded-md border border-[rgba(200,168,75,0.20)] text-[10px] font-bold text-[rgba(200,168,75,0.55)] transition-colors hover:border-ayakashi-gold/50 hover:text-ayakashi-gold disabled:opacity-30"
                    >
                        {p}%
                    </button>
                ))}
            </div>
            <button
                type="button"
                disabled={!valid || busy}
                onClick={() => valid && onSubmit(numeric)}
                className={`h-10 rounded-md border text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${accentClasses}`}
            >
                {busy ? "Processing…" : submitLabel}
            </button>
        </div>
    );
}

// ── Transaction row ───────────────────────────────────────────────
function TxRow({ tx }: { tx: BankVaultTransaction }) {
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
                        minute: "2-digit"
                    })}
                </span>
            </div>
            <span
                className={`flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums ${
                    positive ? "text-green-400" : "text-red-400"
                }`}
            >
                {positive ? "+" : ""}
                {fmt(tx.amount)}
                <CurrencyIcon type={tx.currency} size={13} />
            </span>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────
export default function BankVaultPage() {
    const router = useRouter();
    const [data, setData] = useState<BankVaultResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [txPage, setTxPage] = useState(1);
    const [txLoading, setTxLoading] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(
        null
    );
    const [depositOpen, setDepositOpen] = useState(false);
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [claimPulse, setClaimPulse] = useState(false);
    // See dashboard_page.tsx's identical fix for the full reasoning — a
    // ref, not `data` itself, so `load`'s identity stays stable across
    // refetches instead of retriggering the mount effect below.
    const hasLoadedRef = useRef(false);

    const load = useCallback(
        async (page = 1) => {
            // [FIXED] Was `if (page === 1) setLoading(true)` — every post-
            // action refetch (deposit, withdraw, claim interest, upgrade
            // bank/vault, repair) tripped the SAME `loading` flag used for
            // this page's full-screen spinner (`if (loading) return
            // <spinner/>` below), blanking and redrawing the ENTIRE page on
            // every action — visually identical to a hard reload even though
            // nothing here actually reloads. `loading` now only means "first
            // mount, nothing to show yet"; every refetch after that is a
            // quiet background update. Page > 1 still shows the small,
            // already-scoped txLoading spinner over just the transaction
            // list, since that IS a visible content change worth indicating.
            if (page === 1) {
                if (!hasLoadedRef.current) setLoading(true);
            } else {
                setTxLoading(true);
            }
            setError("");
            try {
                const res = await getBankVault(page);
                setData(res);
                hasLoadedRef.current = true;
            } catch (err) {
                if (err instanceof ApiResponseError && err.status === 401) {
                    router.push("/login");
                    return;
                }
                setError("Couldn't load your bank & vault. Try refreshing.");
            } finally {
                setLoading(false);
                setTxLoading(false);
            }
        },
        [router]
    );

    useEffect(() => {
        load(1);
    }, [load]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    const interestRemaining = useCountdown(
        data?.bank.interestClaim.remainingMs ?? 0
    );
    const withdrawCooldownRemaining = useCountdown(
        data?.bank.withdrawCooldown.remainingMs ?? 0
    );

    const showToast = (msg: string, ok: boolean) => setToast({ msg, ok });

    const runAction = async (key: string, fn: () => Promise<void>) => {
        setBusy(key);
        try {
            await fn();
        } catch (err) {
            showToast(
                err instanceof ApiResponseError
                    ? err.error.message
                    : "Something went wrong.",
                false
            );
        } finally {
            setBusy(null);
        }
    };

    const handleOpenBank = () =>
        runAction("open", async () => {
            await openBankAccount();
            showToast("Bank account opened!", true);
            await load(txPage);
        });

    const handleDeposit = (amount: number) =>
        runAction("deposit", async () => {
            await depositBank(amount);
            showToast(`Deposited ${fmt(amount)} ryo`, true);
            setDepositOpen(false);
            await load(txPage);
        });

    const handleWithdraw = (amount: number) =>
        runAction("withdraw", async () => {
            await withdrawBank(amount);
            showToast(`Withdrew ${fmt(amount)} ryo`, true);
            setWithdrawOpen(false);
            await load(txPage);
        });

    const handleClaimInterest = () =>
        runAction("claim", async () => {
            const res = await claimBankInterest();
            setClaimPulse(true);
            setTimeout(() => setClaimPulse(false), 900);
            showToast(`+${fmt(res.amount)} ryo interest claimed`, true);
            await load(txPage);
        });

    const handleUpgradeBank = () =>
        runAction("upgradeBank", async () => {
            const res = await upgradeBank();
            showToast(`Bank upgraded to Tier ${res.tier}!`, true);
            await load(txPage);
        });

    const handleUpgradeVault = () =>
        runAction("upgradeVault", async () => {
            const res = await upgradeVault();
            showToast(`Vault upgraded to Tier ${res.tier}!`, true);
            await load(txPage);
        });

    const handleRepair = () =>
        runAction("repair", async () => {
            const res = await repairVault();
            showToast(`Vault repaired (+${res.pointsRepaired} HP)`, true);
            await load(txPage);
        });

    const handlePageChange = (p: number) => {
        setTxPage(p);
        load(p);
    };

    if (loading)
        return (
            <div className="flex min-h-[70vh] items-center justify-center">
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
                <p className="text-sm text-[rgba(200,168,75,0.60)]">{error}</p>
                <button
                    type="button"
                    onClick={() => load(1)}
                    className="brush-btn w-48"
                >
                    Retry
                </button>
            </div>
        );

    const { balances, bank, homeVault, transactions } = data;
    const vaultCritical =
        homeVault.owned &&
        homeVault.health.current < homeVault.health.max * 0.3;

    return (
        <>
            <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <div className="section-header">
                    <span className="section-header-text">
                        Bank &amp; Vault
                    </span>
                </div>

                <hr className="gold-rule" />

                {/* ── Pocket balances — quick glance ── */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="form-card flex items-center gap-3 border p-4">
                        <CurrencyIcon type="ryo" size={28} />
                        <div className="flex flex-col gap-0.5">
                            <span className="font-display text-lg font-bold tabular-nums text-[#e6c96a]">
                                {fmt(balances.pocketRyo)}
                            </span>
                            <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                                Pocket Ryo
                            </span>
                        </div>
                    </div>
                    <div className="form-card flex items-center gap-3 border p-4">
                        <CurrencyIcon type="kitsu" size={28} />
                        <div className="flex flex-col gap-0.5">
                            <span className="font-display text-lg font-bold tabular-nums text-[#e6c96a]">
                                {fmt(balances.pocketKitsu)}
                            </span>
                            <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                                Pocket Kitsu
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Bank ── */}
                <div className="vault-card-in form-card flex flex-col overflow-hidden rounded-xl border">
                    <BankHero />
                    <div className="flex flex-col gap-5 p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(200,168,75,0.30)] bg-black/50 text-ayakashi-gold">
                                <Landmark className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                                    Bank
                                </h2>
                                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                                    Safe storage · never robbable
                                </p>
                            </div>
                            {bank.tier > 0 && (
                                <span className="shrink-0 rounded border border-ayakashi-gold/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ayakashi-gold">
                                    Tier {bank.tier}
                                </span>
                            )}
                        </div>

                        {bank.tier === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                                <Lock className="h-6 w-6 text-[rgba(200,168,75,0.35)]" />
                                <p className="text-xs text-[rgba(200,168,75,0.45)]">
                                    You don't have a bank account yet.
                                </p>
                                <button
                                    type="button"
                                    disabled={busy === "open"}
                                    onClick={handleOpenBank}
                                    className="rounded-md border border-ayakashi-gold px-5 py-2 text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:opacity-50"
                                >
                                    {busy === "open"
                                        ? "Opening…"
                                        : "Open Bank Account"}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-end justify-between">
                                        <span className="font-display text-3xl font-bold tabular-nums text-[#e6c96a]">
                                            {fmt(bank.balance)}
                                        </span>
                                        <span className="text-xs text-[rgba(200,168,75,0.40)]">
                                            of {fmt(bank.cap)} cap
                                        </span>
                                    </div>
                                    <FillBar
                                        value={bank.balance}
                                        max={bank.cap}
                                    />
                                </div>

                                {/* Interest claim — the live, animated centerpiece */}
                                <div
                                    className={`flex items-center justify-between gap-3 rounded-lg border p-4 transition-all ${
                                        bank.interestClaim.available
                                            ? "border-green-500/40 bg-green-500/5"
                                            : "border-[rgba(200,168,75,0.15)] bg-black/30"
                                    } ${claimPulse ? "reveal-pop" : ""}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Sparkles
                                            className={`h-5 w-5 ${bank.interestClaim.available ? "text-green-400 reveal-glow-pulse" : "text-[rgba(200,168,75,0.35)]"}`}
                                        />
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                                                Interest ·{" "}
                                                {bank.interestClaim.ratePercent}
                                                %
                                            </span>
                                            <span className="text-sm font-bold text-[#f0e6c8]">
                                                {bank.interestClaim.available
                                                    ? `+${fmt(bank.interestClaim.projectedAmount)} ryo ready`
                                                    : `Next: ${fmtMs(interestRemaining)}`}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={
                                            !bank.interestClaim.available ||
                                            busy === "claim"
                                        }
                                        onClick={handleClaimInterest}
                                        className="shrink-0 rounded-md border border-green-500/50 bg-green-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-green-400 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.15)] disabled:bg-transparent disabled:text-[rgba(200,168,75,0.25)]"
                                    >
                                        {busy === "claim"
                                            ? "Claiming…"
                                            : "Claim"}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDepositOpen(v => !v);
                                                setWithdrawOpen(false);
                                            }}
                                            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-ayakashi-gold text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black"
                                        >
                                            <ArrowDownToLine className="h-3.5 w-3.5" />{" "}
                                            Deposit
                                        </button>
                                        {depositOpen && (
                                            <div className="mt-3">
                                                <AmountPanel
                                                    max={balances.pocketRyo}
                                                    onSubmit={handleDeposit}
                                                    submitLabel="Confirm Deposit"
                                                    busy={busy === "deposit"}
                                                    accent="gold"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            disabled={
                                                withdrawCooldownRemaining > 0
                                            }
                                            onClick={() => {
                                                setWithdrawOpen(v => !v);
                                                setDepositOpen(false);
                                            }}
                                            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[rgba(200,168,75,0.30)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[rgba(200,168,75,0.30)] disabled:hover:text-[rgba(200,168,75,0.60)]"
                                        >
                                            <ArrowUpFromLine className="h-3.5 w-3.5" />
                                            {withdrawCooldownRemaining > 0
                                                ? `On Cooldown — ${fmtMs(withdrawCooldownRemaining)}`
                                                : "Withdraw"}
                                        </button>
                                        {withdrawOpen &&
                                            withdrawCooldownRemaining <= 0 && (
                                                <div className="mt-3">
                                                    <AmountPanel
                                                        max={bank.balance}
                                                        onSubmit={
                                                            handleWithdraw
                                                        }
                                                        submitLabel="Confirm Withdraw"
                                                        busy={
                                                            busy === "withdraw"
                                                        }
                                                        accent="red"
                                                    />
                                                </div>
                                            )}
                                    </div>
                                </div>

                                {!bank.isMaxTier &&
                                    bank.nextTierCost != null && (
                                        <button
                                            type="button"
                                            disabled={busy === "upgradeBank"}
                                            onClick={handleUpgradeBank}
                                            className="flex h-10 items-center justify-center gap-2 rounded-md border border-[rgba(200,168,75,0.25)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:opacity-50"
                                        >
                                            <CurrencyIcon
                                                type="ryo"
                                                size={14}
                                            />{" "}
                                            Upgrade Bank —{" "}
                                            {fmt(bank.nextTierCost)}
                                        </button>
                                    )}
                            </>
                        )}
                    </div>
                </div>

                {/* ── Home Vault ── */}
                <div
                    className={`vault-card-in form-card flex flex-col overflow-hidden rounded-xl border transition-colors ${vaultCritical ? "border-red-500/30" : ""}`}
                    style={{ animationDelay: "90ms" }}
                >
                    <VaultHero
                        critical={vaultCritical}
                        owned={homeVault.owned}
                    />
                    <div className="flex flex-col gap-5 p-5">
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-black/50 ${
                                    vaultCritical
                                        ? "border-red-500/40 text-red-400"
                                        : "border-[rgba(200,168,75,0.30)] text-ayakashi-gold"
                                }`}
                            >
                                <HomeIcon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                                    Home Vault
                                </h2>
                                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                                    Higher yield · can be robbed
                                </p>
                            </div>
                            {homeVault.owned && (
                                <span className="shrink-0 rounded border border-ayakashi-gold/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ayakashi-gold">
                                    Tier {homeVault.tier}
                                </span>
                            )}
                        </div>

                        {!homeVault.owned ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                                <Lock className="h-6 w-6 text-[rgba(200,168,75,0.35)]" />
                                <p className="text-xs text-[rgba(200,168,75,0.45)]">
                                    {homeVault.purchaseInfo.description}
                                </p>
                                <div className="flex items-center gap-1.5 text-sm font-bold text-[#e6c96a]">
                                    <CurrencyIcon
                                        type={homeVault.purchaseInfo.currency}
                                        size={16}
                                    />
                                    {fmt(homeVault.purchaseInfo.price)}
                                </div>
                                <a
                                    href="/shop"
                                    className="rounded-md border border-ayakashi-gold px-5 py-2 text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black"
                                >
                                    Go to Shop
                                </a>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-end justify-between">
                                            <span className="text-lg font-bold tabular-nums text-[#e6c96a]">
                                                {fmt(homeVault.balances.ryo)}
                                            </span>
                                            <span className="text-[10px] text-[rgba(200,168,75,0.40)]">
                                                / {fmt(homeVault.caps.ryo)}
                                            </span>
                                        </div>
                                        <FillBar
                                            value={homeVault.balances.ryo}
                                            max={homeVault.caps.ryo}
                                        />
                                        <span className="text-[9px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
                                            Ryo
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-end justify-between">
                                            <span className="text-lg font-bold tabular-nums text-[#e6c96a]">
                                                {fmt(homeVault.balances.kitsu)}
                                            </span>
                                            <span className="text-[10px] text-[rgba(200,168,75,0.40)]">
                                                / {fmt(homeVault.caps.kitsu)}
                                            </span>
                                        </div>
                                        <FillBar
                                            value={homeVault.balances.kitsu}
                                            max={homeVault.caps.kitsu}
                                        />
                                        <span className="text-[9px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
                                            Kitsu
                                        </span>
                                    </div>
                                </div>

                                {/* Health — the standout visual, mirrors Upgrade page's treatment */}
                                <div className="flex flex-col gap-1.5 rounded-md border border-[rgba(200,168,75,0.12)] bg-black/30 p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
                                            Vault Health
                                        </span>
                                        <span
                                            className={`text-xs font-bold tabular-nums ${vaultCritical ? "text-red-400" : "text-[#e6c96a]"}`}
                                        >
                                            {homeVault.health.current} /{" "}
                                            {homeVault.health.max}
                                        </span>
                                    </div>
                                    <HealthBar
                                        value={homeVault.health.current}
                                        max={homeVault.health.max}
                                    />
                                    {homeVault.vulnerabilityBonusPercent >
                                        0 && (
                                        <p className="flex items-center gap-1.5 text-[10px] text-red-400">
                                            <ShieldAlert className="h-3 w-3" />{" "}
                                            +
                                            {
                                                homeVault.vulnerabilityBonusPercent
                                            }
                                            % rob success chance against you
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2">
                                    {homeVault.repair.needed && (
                                        <button
                                            type="button"
                                            disabled={busy === "repair"}
                                            onClick={handleRepair}
                                            className="flex h-10 items-center justify-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 text-xs font-bold uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                                        >
                                            <Wrench className="h-3.5 w-3.5" />
                                            Repair —{" "}
                                            {fmt(homeVault.repair.ryoCost)} ryo
                                            +{" "}
                                            {homeVault.repair.material.quantity}
                                            ×{" "}
                                            {
                                                homeVault.repair.material
                                                    .displayName
                                            }
                                        </button>
                                    )}
                                    {!homeVault.isMaxTier &&
                                        homeVault.nextTierCost != null && (
                                            <button
                                                type="button"
                                                disabled={
                                                    busy === "upgradeVault"
                                                }
                                                onClick={handleUpgradeVault}
                                                className="flex h-10 items-center justify-center gap-2 rounded-md border border-[rgba(200,168,75,0.25)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:opacity-50"
                                            >
                                                <CurrencyIcon
                                                    type="ryo"
                                                    size={14}
                                                />{" "}
                                                Upgrade Vault —{" "}
                                                {fmt(homeVault.nextTierCost)}
                                            </button>
                                        )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <hr className="gold-rule" />

                {/* ── Transaction history — scoped to bank/vault actions, paginated ── */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#e6c96a]">
                            Bank &amp; Vault History
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
                                No bank or vault activity yet.
                            </p>
                        ) : (
                            transactions.items.map(tx => (
                                <TxRow key={tx.id} tx={tx} />
                            ))
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

            {toast && (
                <div
                    className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 animate-[shop-toast-in_0.3s_ease-out] rounded-md border px-5 py-3 text-sm font-bold shadow-lg lg:bottom-6 ${
                        toast.ok
                            ? "border-ayakashi-gold bg-black/95 text-ayakashi-gold shadow-[0_0_25px_rgba(200,168,75,0.35)]"
                            : "border-red-500/50 bg-black/95 text-red-400"
                    }`}
                >
                    {toast.msg}
                </div>
            )}
        </>
    );
}
