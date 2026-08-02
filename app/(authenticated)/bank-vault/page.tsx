"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBankVault,
  upgradeBank,
  upgradeVault,
  repairVault,
  ApiResponseError,
} from "../../../lib/api";
import type { BankVaultResponse, BankVaultTransaction } from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";
import { CurrencyIcon } from "../../components/CurrencyIcon";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.08)] py-2.5 last:border-0">
      <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.50)]">{label}</span>
      <span className="text-sm font-bold text-[#e6c96a]">{value}</span>
    </div>
  );
}

function TxRow({ tx }: { tx: BankVaultTransaction }) {
  const positive = tx.amount >= 0;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[rgba(200,168,75,0.08)] py-2.5 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-[#f0e6c8]">{tx.description}</span>
        <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
          {tx.location} · {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </span>
      </div>
      <span className={`flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums ${positive ? "text-green-400" : "text-red-400"}`}>
        {positive ? "+" : ""}{fmt(tx.amount)}
        <CurrencyIcon type={tx.currency} size={13} />
      </span>
    </div>
  );
}

export default function BankVaultPage() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();

  const [data, setData] = useState<BankVaultResponse | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const [busyBank, setBusyBank] = useState(false);
  const [busyVault, setBusyVault] = useState(false);
  const [busyRepair, setBusyRepair] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true); setError("");
    try {
      const res = await getBankVault(page);
      setData(res);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setError("Couldn't load bank & vault data. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showErr = (msg: string) => {
    setErrMsg(msg);
    setTimeout(() => setErrMsg(""), 4000);
  };

  const handleBankUpgrade = async () => {
    setBusyBank(true); setErrMsg("");
    try {
      const res = await upgradeBank();
      setToast(`✦ Bank upgraded to Tier ${res.tier} · Cap: ${fmt(res.cap)}`);
      await load(txPage);
      refreshCurrency();
    } catch (err) {
      showErr(err instanceof ApiResponseError ? err.error.message : "Bank upgrade failed.");
    } finally { setBusyBank(false); }
  };

  const handleVaultUpgrade = async () => {
    setBusyVault(true); setErrMsg("");
    try {
      const res = await upgradeVault();
      setToast(`✦ Vault upgraded to Tier ${res.tier}`);
      await load(txPage);
      refreshCurrency();
    } catch (err) {
      showErr(err instanceof ApiResponseError ? err.error.message : "Vault upgrade failed.");
    } finally { setBusyVault(false); }
  };

  const handleRepair = async () => {
    setBusyRepair(true); setErrMsg("");
    try {
      const res = await repairVault();
      setToast(`✦ Vault repaired (${res.pointsRepaired} pts)`);
      await load(txPage);
      refreshCurrency();
    } catch (err) {
      showErr(err instanceof ApiResponseError ? err.error.message : "Repair failed.");
    } finally { setBusyRepair(false); }
  };

  const changeTxPage = (p: number) => {
    setTxPage(p);
    load(p);
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <svg className="h-8 w-8 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );

  if (error || !data) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="text-sm text-[rgba(200,168,75,0.60)]">{error || "Something went wrong."}</p>
      <button type="button" onClick={() => load(1)} className="brush-btn w-40">Retry</button>
    </div>
  );

  const { balances, bank, homeVault, transactions } = data;

  return (
    <>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">

        <div className="section-header">
          <span className="section-header-text">Bank &amp; Vault</span>
        </div>

        <hr className="gold-rule" />

        {/* ── Wallet snapshot ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Pocket Ryo",   value: fmt(balances.pocket.ryo),   type: "ryo"   as const },
            { label: "Pocket Kitsu", value: fmt(balances.pocket.kitsu), type: "kitsu" as const },
            { label: "Bank",         value: fmt(balances.bank.ryo),     type: "bank"  as const },
            { label: "Bank Cap",     value: fmt(balances.bank.cap),     type: "bank"  as const },
          ].map((s) => (
            <div key={s.label} className="form-card flex flex-col items-center gap-1 border p-4 text-center">
              <CurrencyIcon type={s.type} size={32} />
              <span className="text-base font-bold text-[#e6c96a]">{s.value}</span>
              <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">{s.label}</span>
            </div>
          ))}
        </div>

        <hr className="gold-rule" />

        {/* ── Bank card ── */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="form-card flex flex-col gap-4 border p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-[#c8a84b]">
              <CurrencyIcon type="bank" size={18} /> Bank
            </h2>
            <div className="flex flex-col">
              <StatRow label="Tier"    value={String(bank.tier)} />
              <StatRow label="Balance" value={fmt(balances.bank.ryo)} />
              <StatRow label="Cap"     value={fmt(bank.cap)} />
              {bank.upgradeCost && (
                <StatRow label="Upgrade Cost" value={`${fmt(bank.upgradeCost.ryo)} ryo`} />
              )}
            </div>
            <button
              type="button"
              disabled={busyBank || bank.atMaxTier}
              onClick={handleBankUpgrade}
              className="mt-auto h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {bank.atMaxTier ? "Max Tier" : busyBank ? "Upgrading…" : "Upgrade Bank"}
            </button>
          </div>

          {/* ── Home Vault card ── */}
          <div className={`form-card flex flex-col gap-4 border p-5 ${!homeVault ? "opacity-50" : ""}`}>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#c8a84b]">
              Home Vault
            </h2>
            {homeVault ? (
              <>
                <div className="flex flex-col">
                  <StatRow label="Tier"      value={String(homeVault.tier)} />
                  <StatRow label="Ryo"       value={`${fmt(balances.homeVault?.ryo)} / ${fmt(homeVault.caps.ryo)}`} />
                  <StatRow label="Kitsu"     value={`${fmt(balances.homeVault?.kitsu)} / ${fmt(homeVault.caps.kitsu)}`} />
                  <StatRow label="Health"    value={`${homeVault.health} / ${homeVault.maxHealth}`} />
                  {homeVault.vulnerabilityBonus > 0 && (
                    <StatRow label="Vuln. Bonus" value={`+${homeVault.vulnerabilityBonus}%`} />
                  )}
                  {homeVault.upgradeCost && (
                    <StatRow label="Upgrade Cost" value={`${fmt(homeVault.upgradeCost.ryo)} ryo`} />
                  )}
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busyVault || homeVault.atMaxTier}
                    onClick={handleVaultUpgrade}
                    className="h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {homeVault.atMaxTier ? "Max Tier" : busyVault ? "Upgrading…" : "Upgrade Vault"}
                  </button>
                  {homeVault.repairCost && (
                    <button
                      type="button"
                      disabled={busyRepair}
                      onClick={handleRepair}
                      className="h-9 border border-red-500/50 text-xs font-bold uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyRepair
                        ? "Repairing…"
                        : `Repair — ${fmt(homeVault.repairCost.ryo)} ryo + ${homeVault.repairCost.materialQty}× ${homeVault.repairCost.material}`}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-[rgba(200,168,75,0.40)]">
                Buy a Home Vault from the shop to get started.
              </p>
            )}
          </div>
        </div>

        <hr className="gold-rule" />

        {/* ── Transaction history ── */}
        <div>
          <div className="section-header mb-5">
            <span className="section-header-text">History</span>
          </div>

          {transactions.total === 0 ? (
            <p className="text-center text-sm text-[rgba(200,168,75,0.40)]">No transactions yet.</p>
          ) : (
            <>
              <div className="form-card border p-4">
                {transactions.items.map((tx, i) => (
                  <TxRow key={i} tx={tx} />
                ))}
              </div>

              {transactions.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={txPage <= 1}
                    onClick={() => changeTxPage(txPage - 1)}
                    className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-[rgba(200,168,75,0.40)]">
                    Page {transactions.page} / {transactions.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={txPage >= transactions.totalPages}
                    onClick={() => changeTxPage(txPage + 1)}
                    className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {errMsg && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 border border-red-500/50 bg-black/95 px-5 py-3 text-sm font-bold text-red-400 shadow-lg lg:bottom-6">
          {errMsg}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 border border-[#c8a84b] bg-black/95 px-5 py-3 text-sm font-bold text-[#c8a84b] shadow-[0_0_25px_rgba(200,168,75,0.35)] lg:bottom-6">
          {toast}
        </div>
      )}
    </>
  );
}
