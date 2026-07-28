"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getUpgradeTools,
  upgradeTool,
  upgradeBank,
  upgradeVault,
  repairVault,
  getDashboard,
  ApiResponseError,
} from "../../../lib/api";
import type { ToolStatus, UpgradeToolsResponse, DashboardResponse } from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";

function formatNumber(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

const TOOL_EMOJIS: Record<string, string> = {
  gear_shovel:      "🪏",
  gear_fishing_rod: "🎣",
  gear_pickaxe:     "⛏️",
};

// ── Level pips ────────────────────────────────────────────────────
function LevelPips({ level, max = 3 }: { level: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-6 ${
            i < level
              ? "bg-[#c8a84b] shadow-[0_0_6px_rgba(200,168,75,0.6)]"
              : "bg-[rgba(200,168,75,0.12)]"
          }`}
        />
      ))}
    </div>
  );
}

// ── Tool card ─────────────────────────────────────────────────────
function ToolCard({
  tool,
  hasCraftingTable,
  onUpgrade,
  busy,
}: {
  tool: ToolStatus;
  hasCraftingTable: boolean;
  onUpgrade: (toolId: string) => void;
  busy: boolean;
}) {
  const locked = !hasCraftingTable;
  const canUpgrade = !tool.atMax && !locked && !busy;

  return (
    <div className={`form-card flex flex-col gap-4 border p-5 ${locked ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{TOOL_EMOJIS[tool.tool] ?? tool.emoji}</span>
        <div className="flex flex-col gap-1">
          <span className="font-display text-sm font-bold text-[#f0e6c8]">{tool.name}</span>
          <LevelPips level={tool.level} />
        </div>
        <span className="ml-auto text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
          {tool.atMax ? "Max" : `Lv ${tool.level}`}
        </span>
      </div>

      {tool.nextLevelCost && !tool.atMax && (
        <div className="flex flex-col gap-1 border-t border-[rgba(200,168,75,0.10)] pt-3">
          <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
            Cost to reach Lv {tool.level + 1}
          </p>
          <div className="flex items-center gap-4 text-xs text-[rgba(200,168,75,0.65)]">
            <span>🪙 {formatNumber(tool.nextLevelCost.ryo)}</span>
            <span>+</span>
            <span>×{tool.nextLevelCost.materialQty} {tool.nextLevelCost.material}</span>
          </div>
        </div>
      )}

      {locked && (
        <p className="text-[11px] text-[rgba(200,168,75,0.40)]">
          Requires Crafting Table
        </p>
      )}

      <button
        type="button"
        disabled={!canUpgrade}
        onClick={() => onUpgrade(tool.tool)}
        className="h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
      >
        {tool.atMax ? "Maxed Out" : busy ? "Upgrading…" : `Upgrade to Lv ${tool.level + 1}`}
      </button>
    </div>
  );
}

// ── Stat row for bank/vault sections ──────────────────────────────
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.08)] py-2 last:border-0">
      <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.50)]">{label}</span>
      <span className="text-sm font-bold text-[#e6c96a]">{value}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Upgrade() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();

  const [toolsData, setToolsData] = useState<UpgradeToolsResponse | null>(null);
  const [dashData, setDashData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTool, setBusyTool] = useState<string | null>(null);
  const [busyBank, setBusyBank] = useState(false);
  const [busyVault, setBusyVault] = useState(false);
  const [busyRepair, setBusyRepair] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [tools, dash] = await Promise.all([getUpgradeTools(), getDashboard()]);
      setToolsData(tools);
      setDashData(dash);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setError("Couldn't load upgrade data. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const showError = (msg: string) => {
    setErrMsg(msg);
    setTimeout(() => setErrMsg(""), 4000);
  };

  const handleToolUpgrade = async (toolId: string) => {
    setBusyTool(toolId); setErrMsg("");
    try {
      const res = await upgradeTool(toolId);
      setToast(`✦ ${toolId.replace("gear_", "").replace("_", " ")} upgraded to Lv ${res.newLevel}`);
      await load();
      refreshCurrency();
    } catch (err) {
      showError(err instanceof ApiResponseError ? err.error.message : "Upgrade failed.");
    } finally { setBusyTool(null); }
  };

  const handleBankUpgrade = async () => {
    setBusyBank(true); setErrMsg("");
    try {
      const res = await upgradeBank();
      setToast(`✦ Bank upgraded to Tier ${res.tier} · Cap: ${formatNumber(res.cap)}`);
      await load(); refreshCurrency();
    } catch (err) {
      showError(err instanceof ApiResponseError ? err.error.message : "Bank upgrade failed.");
    } finally { setBusyBank(false); }
  };

  const handleVaultUpgrade = async () => {
    setBusyVault(true); setErrMsg("");
    try {
      const res = await upgradeVault();
      setToast(`✦ Vault upgraded to Tier ${res.tier}`);
      await load(); refreshCurrency();
    } catch (err) {
      showError(err instanceof ApiResponseError ? err.error.message : "Vault upgrade failed.");
    } finally { setBusyVault(false); }
  };

  const handleRepair = async () => {
    setBusyRepair(true); setErrMsg("");
    try {
      const res = await repairVault();
      setToast(`✦ Vault repaired (${res.pointsRepaired} pts)`);
      await load(); refreshCurrency();
    } catch (err) {
      showError(err instanceof ApiResponseError ? err.error.message : "Repair failed.");
    } finally { setBusyRepair(false); }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <svg className="h-8 w-8 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );

  if (error) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="theme-body text-sm">{error}</p>
      <button type="button" onClick={load} className="brush-btn w-40">Retry</button>
    </div>
  );

  const vault = dashData?.vault ?? null;

  return (
    <>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">

        <div className="section-header">
          <span className="section-header-text">Upgrade</span>
        </div>

        <hr className="gold-rule" />

        {/* ── Tools ── */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#c8a84b]">
              Gathering Tools
            </h2>
            {toolsData && !toolsData.hasCraftingTable && (
              <span className="border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-400">
                Crafting Table Required
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {toolsData?.tools.map((tool) => (
              <ToolCard
                key={tool.tool}
                tool={tool}
                hasCraftingTable={toolsData.hasCraftingTable}
                onUpgrade={handleToolUpgrade}
                busy={busyTool === tool.tool}
              />
            ))}
          </div>
        </div>

        <hr className="gold-rule" />

        {/* ── Bank + Vault side by side ── */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

          {/* Bank */}
          <div className="form-card flex flex-col gap-4 border p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#c8a84b]">
              🏦 Bank
            </h2>
            {dashData && (
              <div className="flex flex-col">
                <StatRow label="Tier"    value={String(dashData.currency.bankVaultTier)} />
                <StatRow label="Balance" value={formatNumber(dashData.currency.bank)} />
                <StatRow label="Cap"     value={formatNumber(dashData.currency.bankCap)} />
              </div>
            )}
            <button
              type="button"
              disabled={busyBank}
              onClick={handleBankUpgrade}
              className="mt-auto h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyBank ? "Upgrading…" : "Upgrade Bank Tier"}
            </button>
          </div>

          {/* Vault */}
          <div className={`form-card flex flex-col gap-4 border p-5 ${!vault ? "opacity-50" : ""}`}>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#c8a84b]">
              🏠 Home Vault
            </h2>
            {vault ? (
              <div className="flex flex-col">
                <StatRow label="Tier"       value={String(vault.tier)} />
                <StatRow label="Ryo"        value={`${formatNumber(vault.ryo)} / ${formatNumber(vault.ryoCap)}`} />
                <StatRow label="Kitsu"      value={`${formatNumber(vault.kitsu)} / ${formatNumber(vault.kitsuCap)}`} />
                <StatRow label="Health"     value={`${vault.health} / ${vault.maxHealth}`} />
              </div>
            ) : (
              <p className="text-xs text-[rgba(200,168,75,0.40)]">
                Buy a Home Vault from the shop first.
              </p>
            )}
            <div className="mt-auto flex flex-col gap-2">
              <button
                type="button"
                disabled={busyVault || !vault}
                onClick={handleVaultUpgrade}
                className="h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyVault ? "Upgrading…" : "Upgrade Vault Tier"}
              </button>
              {vault?.repairCost && (
                <button
                  type="button"
                  disabled={busyRepair}
                  onClick={handleRepair}
                  className="h-9 border border-red-500/50 text-xs font-bold uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyRepair
                    ? "Repairing…"
                    : `Repair Vault — ${formatNumber(vault.repairCost.ryo)} ryo + ${vault.repairCost.materialQty}× ${vault.repairCost.material}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Error toast */}
      {errMsg && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 border border-red-500/50 bg-black/95 px-5 py-3 text-sm font-bold text-red-400 shadow-lg">
          {errMsg}
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 border border-[#c8a84b] bg-black/95 px-5 py-3 text-sm font-bold text-[#c8a84b] shadow-[0_0_25px_rgba(200,168,75,0.35)] animate-[shop-toast-in_0.3s_ease-out] lg:bottom-6">
          {toast}
        </div>
      )}
    </>
  );
}
