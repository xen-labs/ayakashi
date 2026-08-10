"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldAlert, Wrench, Landmark, Home } from "lucide-react";
import {
  getUpgradeTools,
  upgradeTool,
  upgradeBank,
  upgradeVault,
  repairVault,
  getDashboard,
  ApiResponseError,
} from "../../../lib/api";
import type {
  ToolStatus,
  UpgradeToolsResponse,
  DashboardResponse,
} from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";
import { CurrencyIcon } from "../../components/CurrencyIcon";

function formatNumber(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

const TOOL_EMOJIS: Record<string, string> = {
  gear_shovel: "🪏",
  gear_fishing_rod: "🎣",
  gear_pickaxe: "⛏️",
};

// ── Item art — image with emoji fallback (matches craft page) ───────
function ItemArt({
  src,
  emoji,
  alt,
  size = 48,
}: {
  src?: string;
  emoji: string;
  alt: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-lg bg-black/40 shadow-[0_0_0_1px_rgba(200,168,75,0.20)]"
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="object-contain p-1"
          unoptimized
          onError={() => setBroken(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.5 }}>{emoji}</span>
      )}
    </div>
  );
}

// ── Level pips ────────────────────────────────────────────────────
function LevelPips({ level, max = 3 }: { level: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-6 rounded-sm transition-colors duration-300 ${
            i < level
              ? "bg-ayakashi-gold shadow-[0_0_6px_rgba(200,168,75,0.6)]"
              : "bg-[rgba(200,168,75,0.12)]"
          }`}
        />
      ))}
    </div>
  );
}

// ── Fill bar — used for bank cap + vault caps ────────────────────────
function FillBar({
  value,
  max,
  colorClass = "bg-ayakashi-gold",
}: {
  value: number;
  max: number;
  colorClass?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(200,168,75,0.10)]">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Health bar — color shifts gold → amber → red as it drops ────────
function HealthBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color =
    pct > 60 ? "bg-ayakashi-gold" : pct > 30 ? "bg-amber-500" : "bg-red-500";
  const glow =
    pct > 60
      ? "shadow-[0_0_8px_rgba(200,168,75,0.5)]"
      : pct > 30
        ? "shadow-[0_0_8px_rgba(245,158,11,0.5)]"
        : "shadow-[0_0_10px_rgba(239,68,68,0.6)]";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/50">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color} ${glow}`}
        style={{ width: `${pct}%` }}
      />
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
  const notCrafted = tool.level === 0;
  const canUpgrade = !tool.atMax && !locked && !busy && !notCrafted;

  return (
    <div
      className={`form-card flex flex-col gap-4 rounded-xl border p-5 transition-all duration-200 ${
        locked ? "opacity-50" : "hover:border-[rgba(200,168,75,0.35)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <ItemArt
          src={`/items/${tool.tool}.webp`}
          emoji={TOOL_EMOJIS[tool.tool] ?? tool.emoji}
          alt={tool.name}
          size={48}
        />
        <div className="flex flex-col gap-1">
          <span className="font-display text-sm font-bold text-[#f0e6c8]">
            {tool.name}
          </span>
          <LevelPips level={tool.level} />
        </div>
        <span className="ml-auto shrink-0 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
          {tool.atMax ? "Max" : notCrafted ? "Not Owned" : `Lv ${tool.level}`}
        </span>
      </div>

      {tool.nextLevelCost && !tool.atMax && !notCrafted && (
        <div className="flex items-center gap-4 rounded-md border border-[rgba(200,168,75,0.15)] bg-white/[0.02] px-3 py-2 text-xs text-[rgba(200,168,75,0.65)]">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <CurrencyIcon type="ryo" size={14} />{" "}
            {formatNumber(tool.nextLevelCost.ryo)}
          </span>
          <span className="text-[rgba(200,168,75,0.30)]">+</span>
          <span className="truncate">
            ×{tool.nextLevelCost.materialQty} {tool.nextLevelCost.material}
          </span>
        </div>
      )}

      {notCrafted && !locked && (
        <p className="text-[11px] text-[rgba(200,168,75,0.45)]">
          Craft one first, then upgrade it here.
        </p>
      )}
      {locked && (
        <p className="flex items-center gap-1.5 text-[11px] text-[rgba(200,168,75,0.40)]">
          <ShieldAlert className="h-3.5 w-3.5" /> Requires Crafting Table
        </p>
      )}

      <button
        type="button"
        disabled={!canUpgrade}
        onClick={() => onUpgrade(tool.tool)}
        className="mt-auto h-9 rounded-md border border-ayakashi-gold text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
      >
        {tool.atMax
          ? "Maxed Out"
          : notCrafted
            ? "Craft in Craft Page"
            : busy
              ? "Upgrading…"
              : `Upgrade to Lv ${tool.level + 1}`}
      </button>
    </div>
  );
}

// ── Stat row for bank/vault sections ──────────────────────────────
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.08)] py-2 last:border-0">
      <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums text-[#e6c96a]">
        {value}
      </span>
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
    setLoading(true);
    setError("");
    try {
      const [tools, dash] = await Promise.all([
        getUpgradeTools(),
        getDashboard(),
      ]);
      setToolsData(tools);
      setDashData(dash);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError("Couldn't load upgrade data. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

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
    const tool = toolsData?.tools.find((t) => t.tool === toolId);
    if (tool?.level === 0) {
      router.push("/craft");
      return;
    }
    setBusyTool(toolId);
    setErrMsg("");
    try {
      const res = await upgradeTool(toolId);
      setToast(
        `✦ ${toolId.replace("gear_", "").replace("_", " ")} upgraded to Lv ${res.newLevel}`,
      );
      await load();
      refreshCurrency();
    } catch (err) {
      showError(
        err instanceof ApiResponseError ? err.error.message : "Upgrade failed.",
      );
    } finally {
      setBusyTool(null);
    }
  };

  const handleBankUpgrade = async () => {
    setBusyBank(true);
    setErrMsg("");
    try {
      const res = await upgradeBank();
      setToast(
        `✦ Bank upgraded to Tier ${res.tier} · Cap: ${formatNumber(res.cap)}`,
      );
      await load();
      refreshCurrency();
    } catch (err) {
      showError(
        err instanceof ApiResponseError
          ? err.error.message
          : "Bank upgrade failed.",
      );
    } finally {
      setBusyBank(false);
    }
  };

  const handleVaultUpgrade = async () => {
    setBusyVault(true);
    setErrMsg("");
    try {
      const res = await upgradeVault();
      setToast(`✦ Vault upgraded to Tier ${res.tier}`);
      await load();
      refreshCurrency();
    } catch (err) {
      showError(
        err instanceof ApiResponseError
          ? err.error.message
          : "Vault upgrade failed.",
      );
    } finally {
      setBusyVault(false);
    }
  };

  const handleRepair = async () => {
    setBusyRepair(true);
    setErrMsg("");
    try {
      const res = await repairVault();
      setToast(`✦ Vault repaired (${res.pointsRepaired} pts)`);
      await load();
      refreshCurrency();
    } catch (err) {
      showError(
        err instanceof ApiResponseError ? err.error.message : "Repair failed.",
      );
    } finally {
      setBusyRepair(false);
    }
  };

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

  if (error)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="theme-body text-sm">{error}</p>
        <button type="button" onClick={load} className="brush-btn w-40">
          Retry
        </button>
      </div>
    );

  const vault = dashData?.vault ?? null;
  const vaultHealthPct =
    vault && vault.maxHealth > 0 ? (vault.health / vault.maxHealth) * 100 : 100;
  const vaultCritical = vault ? vaultHealthPct <= 30 : false;

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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(200,168,75,0.30)] bg-black/50 text-ayakashi-gold">
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                Gathering Tools
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                Level up equipment you already own
              </p>
            </div>
            {toolsData && !toolsData.hasCraftingTable && (
              <span className="ml-auto shrink-0 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-400">
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
          <div className="form-card flex flex-col gap-4 rounded-xl border p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(200,168,75,0.30)] bg-black/50 text-ayakashi-gold">
                <Landmark className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                  Bank
                </h2>
                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                  Safe ryo storage · never robbable
                </p>
              </div>
            </div>

            {dashData && (
              <>
                <div className="flex flex-col">
                  <StatRow
                    label="Tier"
                    value={String(dashData.currency.bankVaultTier)}
                  />
                  <StatRow
                    label="Balance"
                    value={formatNumber(dashData.currency.bank)}
                  />
                  <StatRow
                    label="Cap"
                    value={formatNumber(dashData.currency.bankCap)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FillBar
                    value={dashData.currency.bank}
                    max={dashData.currency.bankCap}
                  />
                  <p className="text-right text-[10px] text-[rgba(200,168,75,0.35)]">
                    {Math.min(
                      100,
                      Math.round(
                        (dashData.currency.bank /
                          Math.max(1, dashData.currency.bankCap)) *
                          100,
                      ),
                    )}
                    % full
                  </p>
                </div>
              </>
            )}

            <button
              type="button"
              disabled={busyBank}
              onClick={handleBankUpgrade}
              className="mt-auto h-9 rounded-md border border-ayakashi-gold text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyBank ? "Upgrading…" : "Upgrade Bank Tier"}
            </button>
          </div>

          {/* Vault */}
          <div
            className={`form-card flex flex-col gap-4 rounded-xl border p-5 transition-colors duration-300 ${
              !vault ? "opacity-50" : vaultCritical ? "border-red-500/30" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-black/50 ${
                  vaultCritical
                    ? "border-red-500/40 text-red-400"
                    : "border-[rgba(200,168,75,0.30)] text-ayakashi-gold"
                }`}
              >
                <Home className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                  Home Vault
                </h2>
                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                  Higher yield · can be robbed
                </p>
              </div>
            </div>

            {vault ? (
              <>
                <div className="flex flex-col">
                  <StatRow label="Tier" value={String(vault.tier)} />
                  <StatRow
                    label="Ryo"
                    value={`${formatNumber(vault.ryo)} / ${formatNumber(vault.ryoCap)}`}
                  />
                  <StatRow
                    label="Kitsu"
                    value={`${formatNumber(vault.kitsu)} / ${formatNumber(vault.kitsuCap)}`}
                  />
                </div>

                {/* Health bar — the standout visual for this card */}
                <div className="flex flex-col gap-1.5 rounded-md border border-[rgba(200,168,75,0.12)] bg-black/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
                      Vault Health
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${vaultCritical ? "text-red-400" : "text-[#e6c96a]"}`}
                    >
                      {vault.health} / {vault.maxHealth}
                    </span>
                  </div>
                  <HealthBar value={vault.health} max={vault.maxHealth} />
                  {vaultCritical && (
                    <p className="flex items-center gap-1.5 text-[10px] text-red-400">
                      <ShieldAlert className="h-3 w-3" /> Vulnerable — repair
                      soon
                    </p>
                  )}
                </div>
              </>
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
                className="h-9 rounded-md border border-ayakashi-gold text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyVault ? "Upgrading…" : "Upgrade Vault Tier"}
              </button>
              {vault?.repairCost && (
                <button
                  type="button"
                  disabled={busyRepair}
                  onClick={handleRepair}
                  className={`h-9 rounded-md border text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    vaultCritical
                      ? "border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-black"
                      : "border-red-500/50 text-red-400 hover:bg-red-500/10"
                  }`}
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
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md border border-red-500/50 bg-black/95 px-5 py-3 text-sm font-bold text-red-400 shadow-lg lg:bottom-6">
          {errMsg}
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 animate-[shop-toast-in_0.3s_ease-out] rounded-md border border-ayakashi-gold bg-black/95 px-5 py-3 text-sm font-bold text-ayakashi-gold shadow-[0_0_25px_rgba(200,168,75,0.35)] lg:bottom-6">
          {toast}
        </div>
      )}
    </>
  );
}
