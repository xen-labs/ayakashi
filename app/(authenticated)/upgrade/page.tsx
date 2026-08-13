"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldAlert, Wrench, Landmark, Home, Sparkles, X } from "lucide-react";
import {
  getUpgradeTools,
  upgradeTool,
  upgradeBank,
  upgradeVault,
  repairVault,
  getDashboard,
  getInventory,
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

// Client-side display copy of games/upgradeItems.ts's TOOL_BREAK_CHANCE —
// purely presentational (an approximate reliability line on the card),
// not used for any calculation, so it's fine to inline rather than add
// a backend field just to show it. If the backend curve changes, update
// this to match — worst case is a stale flavor line, not a wrong price.
const TOOL_RELIABILITY: Record<0 | 1 | 2 | 3, string> = {
  0: "",
  1: "Reliable — rarely breaks",
  2: "Riskiest tier — real wear starts here",
  3: "Durable — safer than Lv.2, not quite Lv.1",
};

// ── Item art — image with emoji fallback. Reads tool.webappImage, resolved
// server-side per the tool's CURRENT level via itemRegistry.ts (see
// upgrade.ts's GET /upgrade/tools). Previously this hardcoded a bare
// /items/${tool}.webp path that never matched any real asset location and
// silently fell back to the emoji for every tool at every level. ───────
function ItemArt({
  src,
  emoji,
  alt,
  frame = "card",
}: {
  src?: string;
  emoji: string;
  alt: string;
  frame?: "card" | "thumb";
}) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  const isThumb = frame === "thumb";
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-[rgba(200,168,75,0.04)] ${
        isThumb
          ? "h-16 w-16 shrink-0 rounded-lg border border-[rgba(200,168,75,0.15)]"
          : "aspect-square w-full border-b border-[rgba(200,168,75,0.12)]"
      }`}
    >
      {showImg ? (
        <Image
          src={src}
          alt={alt}
          width={isThumb ? 64 : 200}
          height={isThumb ? 64 : 200}
          className={`relative object-contain drop-shadow-[0_4px_16px_rgba(200,168,75,0.35)] transition-transform duration-300 group-hover:scale-[1.08] ${
            isThumb ? "h-11 w-11" : "h-[80%] w-[80%] p-2"
          }`}
          unoptimized
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          className={`relative leading-none select-none transition-transform duration-300 group-hover:scale-110 ${isThumb ? "text-3xl" : "text-7xl"}`}
        >
          {emoji}
        </span>
      )}
    </div>
  );
}

// ── Level pips — filled pip now carries the gold glow the rest of the
// site's rarity system uses, plus a lit-in-sequence entrance instead of
// a static row, so hitting a new level actually reads as an event.
function LevelPips({ level, max = 3 }: { level: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-6 rounded-sm transition-all duration-500 ${
            i < level
              ? "bg-ayakashi-gold shadow-[0_0_8px_rgba(200,168,75,0.65)]"
              : "bg-[rgba(200,168,75,0.12)]"
          }`}
          style={{ transitionDelay: i < level ? `${i * 80}ms` : "0ms" }}
        />
      ))}
    </div>
  );
}

// ── Fill bar ──────────────────────────────────────────────────────
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

// ── Health bar ────────────────────────────────────────────────────
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
// Rebuilt on craft-card + item-card-lift (the same hover-lift/shadow
// combo shop and inventory already use) instead of the generic
// form-card, plus a shop-card-in staggered entrance so the three tool
// cards animate in rather than just appearing. The cost row now
// pulses red (chip-short-pulse, borrowed from craft's insufficient-
// material warning) when the player can't currently afford the next
// level, instead of showing the exact same static cost chip whether
// affordable or not.
//
// [NEW] canAfford now folds in EVERY requirement — ryo, the base
// material, AND every entry in nextLevelCost.extra (Gold Ingot + Cut
// Diamond at Lv.2/Lv.3) — computed by the parent from live inventory
// data, not just ryo. The cost chip below also renders each extra
// requirement as its own segment, and turns red per-segment when that
// specific item is short, so a player missing only diamond (say) can
// see exactly which requirement is the blocker instead of a single
// all-or-nothing red chip.
function ToolCard({
  tool,
  index,
  hasCraftingTable,
  canAfford,
  haveOf,
  onUpgrade,
  busy,
}: {
  tool: ToolStatus;
  index: number;
  hasCraftingTable: boolean;
  canAfford: boolean;
  haveOf: (itemId: string) => number;
  onUpgrade: (toolId: string) => void;
  busy: boolean;
}) {
  const locked = !hasCraftingTable;
  const notCrafted = tool.level === 0;
  const canUpgrade = !tool.atMax && !locked && !busy && !notCrafted;
  const reliability = TOOL_RELIABILITY[tool.level];

  const haveBaseMaterial = tool.nextLevelCost
    ? haveOf(tool.nextLevelCost.material)
    : 0;
  const baseMaterialShort = tool.nextLevelCost
    ? haveBaseMaterial < tool.nextLevelCost.materialQty
    : false;

  return (
    <div
      className={`craft-card item-card-lift group flex flex-col overflow-hidden rounded-xl [animation:shop-card-in_0.35s_ease-out_backwards] ${
        locked ? "craft-card-locked" : ""
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative">
        <ItemArt
          src={tool.webappImage}
          emoji={TOOL_EMOJIS[tool.tool] ?? tool.emoji}
          alt={tool.name}
        />
        <span className="absolute right-2 top-2 rounded border border-[rgba(200,168,75,0.35)] bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#c8a84b] backdrop-blur-sm">
          {tool.atMax ? "Max" : notCrafted ? "Not Owned" : `Lv ${tool.level}`}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-sm font-bold text-[#f0e6c8]">
            {tool.name}
          </span>
          <LevelPips level={tool.level} />
          {reliability && !tool.atMax && (
            <p className="text-[10px] italic leading-4 text-[rgba(200,168,75,0.45)]">
              {reliability}
            </p>
          )}
        </div>

        {tool.nextLevelCost && !tool.atMax && !notCrafted && (
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-2 text-xs transition-colors ${
              canAfford
                ? "border-[rgba(200,168,75,0.15)] bg-white/[0.02] text-[rgba(200,168,75,0.65)]"
                : "chip-short border-red-500/35 bg-red-500/5 text-red-300/80"
            }`}
          >
            <span className="flex items-center gap-1 whitespace-nowrap">
              <CurrencyIcon type="ryo" size={14} />{" "}
              {formatNumber(tool.nextLevelCost.ryo)}
            </span>
            <span className="text-[rgba(200,168,75,0.30)]">+</span>
            <span
              className={`truncate ${baseMaterialShort ? "text-red-300" : ""}`}
            >
              ×{tool.nextLevelCost.materialQty} {tool.nextLevelCost.material}
            </span>
            {tool.nextLevelCost.extra?.map((e) => {
              const short = haveOf(e.itemId) < e.qty;
              return (
                <span key={e.itemId} className="flex items-center gap-1">
                  <span className="text-[rgba(200,168,75,0.30)]">+</span>
                  <span className={`truncate ${short ? "text-red-300" : ""}`}>
                    ×{e.qty} {e.name}
                  </span>
                </span>
              );
            })}
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
    </div>
  );
}

// ── Stat row ──────────────────────────────────────────────────────
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.08)] py-2 last:border-0">
      <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
        {label}
      </span>
      <span
        key={value}
        className="number-tick text-sm font-bold tabular-nums text-[#e6c96a]"
      >
        {value}
      </span>
    </div>
  );
}

// ── Result modal — reuses shop's exact reveal-pop / shake-fail
// celebration language for tool/bank/vault upgrades, instead of a flat
// text toast. Keeps the same craft-modal-pop entrance as every other
// modal on the site. ──────────────────────────────────────────────
type ResultPhase = "success" | "fail";

function ResultModal({
  phase,
  title,
  detail,
  onClose,
}: {
  phase: ResultPhase;
  title: string;
  detail: string;
  onClose: () => void;
}) {
  return (
    <dialog
      open
      className="craft-modal-pop fixed inset-0 z-50 m-auto w-full max-w-sm border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      aria-modal="true"
    >
      {phase === "success" ? (
        <div className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="reveal-pop relative flex h-24 w-24 items-center justify-center">
            <div className="reveal-glow-pulse absolute inset-0 rounded-full bg-[#c8a84b]/20 blur-xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(200,168,75,0.30)] bg-black/40">
              <Sparkles className="h-9 w-9 text-[#e6c96a]" />
            </div>
            <span
              className="ember-particle absolute bottom-0 left-3 h-1.5 w-1.5 rounded-full bg-[#e6c96a]"
              style={{ animationDelay: "0s" }}
            />
            <span
              className="ember-particle absolute bottom-0 right-4 h-1.5 w-1.5 rounded-full bg-[#e6c96a]"
              style={{ animationDelay: "0.4s" }}
            />
            <span
              className="ember-particle absolute bottom-2 left-1/2 h-1.5 w-1.5 rounded-full bg-[#e6c96a]"
              style={{ animationDelay: "0.8s" }}
            />
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-wide text-[#e6c96a]">
              {title}
            </p>
            <p className="number-tick mt-1 text-sm text-[#f0e6c8]">{detail}</p>
          </div>
          <button type="button" onClick={onClose} className="brush-btn w-40">
            Nice
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="shake-fail flex h-24 w-24 items-center justify-center rounded-full border border-red-500/30 bg-red-500/5">
            <X className="h-10 w-10 text-red-400/80" />
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-wide text-red-400">
              {title}
            </p>
            <p className="mt-1 text-xs text-[rgba(200,168,75,0.45)]">
              {detail}
            </p>
          </div>
          <button type="button" onClick={onClose} className="brush-btn w-40">
            Close
          </button>
        </div>
      )}
    </dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Upgrade() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();

  const [toolsData, setToolsData] = useState<UpgradeToolsResponse | null>(null);
  const [dashData, setDashData] = useState<DashboardResponse | null>(null);
  // [NEW] itemId -> quantity, built from GET /inventory. This is what
  // makes real affordability (base material + every extra material)
  // possible on this page — previously only ryo was ever checked.
  const [inventoryQty, setInventoryQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTool, setBusyTool] = useState<string | null>(null);
  const [busyBank, setBusyBank] = useState(false);
  const [busyVault, setBusyVault] = useState(false);
  const [busyRepair, setBusyRepair] = useState(false);
  const [result, setResult] = useState<{
    phase: ResultPhase;
    title: string;
    detail: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tools, dash, inventory] = await Promise.all([
        getUpgradeTools(),
        getDashboard(),
        getInventory(),
      ]);
      setToolsData(tools);
      setDashData(dash);
      const qty: Record<string, number> = {};
      for (const item of inventory.items) {
        qty[item.itemId] = item.quantity;
      }
      setInventoryQty(qty);
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

  // [NEW] Single lookup used by both the affordability calc below and the
  // ToolCard's per-segment short-material highlighting.
  const haveOf = useCallback(
    (itemId: string) => inventoryQty[itemId] ?? 0,
    [inventoryQty],
  );

  const showFail = (title: string, detail: string) =>
    setResult({ phase: "fail", title, detail });

  const handleToolUpgrade = async (toolId: string) => {
    const tool = toolsData?.tools.find((t) => t.tool === toolId);
    if (tool?.level === 0) {
      router.push("/craft");
      return;
    }
    setBusyTool(toolId);
    try {
      const res = await upgradeTool(toolId);
      setResult({
        phase: "success",
        title: "Tool Upgraded",
        detail: `${toolId.replace("gear_", "").replace("_", " ")} → Lv ${res.newLevel}`,
      });
      await load();
      refreshCurrency();
    } catch (err) {
      showFail(
        "Upgrade Failed",
        err instanceof ApiResponseError
          ? err.error.message
          : "Something went wrong.",
      );
    } finally {
      setBusyTool(null);
    }
  };

  const handleBankUpgrade = async () => {
    setBusyBank(true);
    try {
      const res = await upgradeBank();
      setResult({
        phase: "success",
        title: "Bank Upgraded",
        detail: `Tier ${res.tier} · Cap: ${formatNumber(res.cap)}`,
      });
      await load();
      refreshCurrency();
    } catch (err) {
      showFail(
        "Bank Upgrade Failed",
        err instanceof ApiResponseError
          ? err.error.message
          : "Something went wrong.",
      );
    } finally {
      setBusyBank(false);
    }
  };

  const handleVaultUpgrade = async () => {
    setBusyVault(true);
    try {
      const res = await upgradeVault();
      setResult({
        phase: "success",
        title: "Vault Upgraded",
        detail: `Tier ${res.tier}`,
      });
      await load();
      refreshCurrency();
    } catch (err) {
      showFail(
        "Vault Upgrade Failed",
        err instanceof ApiResponseError
          ? err.error.message
          : "Something went wrong.",
      );
    } finally {
      setBusyVault(false);
    }
  };

  const handleRepair = async () => {
    setBusyRepair(true);
    try {
      const res = await repairVault();
      setResult({
        phase: "success",
        title: "Vault Repaired",
        detail: `${res.pointsRepaired} health points restored`,
      });
      await load();
      refreshCurrency();
    } catch (err) {
      showFail(
        "Repair Failed",
        err instanceof ApiResponseError
          ? err.error.message
          : "Something went wrong.",
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
            {toolsData?.tools.map((tool, i) => {
              // [CHANGED] Was ryo-only. Now folds in the base material AND
              // every entry in nextLevelCost.extra (Gold Ingot + Cut
              // Diamond) against live inventory quantities, so the button
              // and cost chip actually reflect whether the upgrade will
              // succeed — not just whether the player can afford the ryo
              // half of it.
              const cost = tool.nextLevelCost;
              const affordable = cost
                ? dashData != null &&
                  dashData.currency.ryo >= cost.ryo &&
                  haveOf(cost.material) >= cost.materialQty &&
                  (cost.extra ?? []).every((e) => haveOf(e.itemId) >= e.qty)
                : true;
              return (
                <ToolCard
                  key={tool.tool}
                  tool={tool}
                  index={i}
                  hasCraftingTable={toolsData.hasCraftingTable}
                  canAfford={affordable}
                  haveOf={haveOf}
                  onUpgrade={handleToolUpgrade}
                  busy={busyTool === tool.tool}
                />
              );
            })}
          </div>
        </div>

        <hr className="gold-rule" />

        {/* ── Bank + Vault side by side ── */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Bank */}
          <div className="craft-card flex flex-col gap-4 rounded-xl p-5">
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
            className={`craft-card flex flex-col gap-4 rounded-xl p-5 transition-colors duration-300 ${
              !vault
                ? "craft-card-locked"
                : vaultCritical
                  ? "border-red-500/30"
                  : ""
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

                {/* Health bar — pulses via reveal-glow-pulse when critical,
                    same urgency language the site already uses for other
                    low-resource states, instead of a static red bar. */}
                <div
                  className={`flex flex-col gap-1.5 rounded-md border p-3 ${
                    vaultCritical
                      ? "border-red-500/25 bg-red-500/5"
                      : "border-[rgba(200,168,75,0.12)] bg-black/30"
                  }`}
                >
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
                    <p className="reveal-glow-pulse flex items-center gap-1.5 text-[10px] text-red-400">
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

      {result && (
        <ResultModal
          phase={result.phase}
          title={result.title}
          detail={result.detail}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}
