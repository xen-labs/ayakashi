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
  frame?: "card" | "thumb" | "chip" | "ingredient";
}) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  const isThumb = frame === "thumb";
  const isChip = frame === "chip";
  const isIngredient = frame === "ingredient";

  // Small inline badge for cost-strip material icons — sized to sit next
  // to a "×N Name" label rather than stand alone like the thumb frame.
  if (isChip) {
    return (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm">
        {showImg ? (
          <Image
            src={src}
            alt={alt}
            width={16}
            height={16}
            className="h-4 w-4 object-contain"
            unoptimized
            onError={() => setBroken(true)}
          />
        ) : (
          <span aria-hidden className="text-[13px] leading-none">
            {emoji}
          </span>
        )}
      </span>
    );
  }

  // [NEW] Ingredient slot — the old 16px "chip" badge was too small to
  // actually read as ingredient art, just decorative dust next to a wall
  // of text. This is a real square tile (44px) with its own bordered
  // frame and glow-on-hover, sized to sit inside a labeled slot rather
  // than inline in a sentence — see the redesigned cost section below.
  if (isIngredient) {
    return (
      <div className="group/ing relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[rgba(200,168,75,0.20)] bg-black/40 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover/slot:scale-105">
        {showImg ? (
          <Image
            src={src}
            alt={alt}
            width={44}
            height={44}
            className="h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(200,168,75,0.4)]"
            unoptimized
            onError={() => setBroken(true)}
          />
        ) : (
          <span aria-hidden className="text-2xl leading-none">
            {emoji}
          </span>
        )}
      </div>
    );
  }

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
// cards animate in rather than just appearing.
//
// [CHANGED — this pass] Ingredient tray replaces the old inline cost
// chip: ryo and each material now get their own bordered 44px slot
// (ItemArt's new `frame="ingredient"`) instead of a 16px icon buried in
// a wall of "×N Name" text. Each slot pulses red independently
// (chip-short-pulse) when that specific requirement — ryo via the new
// haveRyo prop, or a material via haveOf — is short, so a player missing
// only diamond (say) sees exactly which slot is the blocker instead of
// one all-or-nothing red chip. Dropped the parent-computed `canAfford`
// prop since nothing in this component read it anymore once shortfall
// moved to per-slot checks — the upgrade button's disabled state was
// never gated on affordability either before or after this pass (only
// atMax/locked/busy/notCrafted — see canUpgrade below); that's
// unchanged, unrelated pre-existing behavior.
function ToolCard({
  tool,
  index,
  hasCraftingTable,
  haveOf,
  haveRyo,
  onUpgrade,
  busy,
}: {
  tool: ToolStatus;
  index: number;
  hasCraftingTable: boolean;
  haveOf: (itemId: string) => number;
  haveRyo: number;
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
          <div className="flex flex-wrap gap-2">
            {/* Ryo — its own slot so the currency reads as an ingredient
                too, not a separate inline prefix bolted onto the row. */}
            <div
              className={`flex flex-col items-center gap-1 rounded-lg border px-2.5 py-2 transition-colors ${
                haveRyo >= tool.nextLevelCost.ryo
                  ? "border-[rgba(200,168,75,0.20)] bg-white/[0.02]"
                  : "chip-short border-red-500/35 bg-red-500/5"
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center">
                <CurrencyIcon type="ryo" size={30} />
              </span>
              <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-[rgba(200,168,75,0.75)]">
                {formatNumber(tool.nextLevelCost.ryo)}
              </span>
            </div>

            {/* Base material — real 44px art in its own bordered slot,
                qty/name underneath, instead of a 16px inline icon buried
                in a sentence. */}
            <div
              className={`group/slot flex flex-col items-center gap-1 rounded-lg border px-2.5 py-2 transition-colors ${
                baseMaterialShort
                  ? "chip-short border-red-500/35 bg-red-500/5"
                  : "border-[rgba(200,168,75,0.20)] bg-white/[0.02]"
              }`}
            >
              <ItemArt
                src={tool.nextLevelCost.materialWebappImage}
                emoji={tool.nextLevelCost.materialEmoji}
                alt={tool.nextLevelCost.materialName}
                frame="ingredient"
              />
              <span
                className={`max-w-[72px] truncate text-[11px] font-bold ${baseMaterialShort ? "text-red-300" : "text-[rgba(200,168,75,0.75)]"}`}
              >
                ×{tool.nextLevelCost.materialQty}
              </span>
            </div>

            {tool.nextLevelCost.extra?.map((e) => {
              const short = haveOf(e.itemId) < e.qty;
              return (
                <div
                  key={e.itemId}
                  className={`group/slot flex flex-col items-center gap-1 rounded-lg border px-2.5 py-2 transition-colors ${
                    short
                      ? "chip-short border-red-500/35 bg-red-500/5"
                      : "border-[rgba(200,168,75,0.20)] bg-white/[0.02]"
                  }`}
                >
                  <ItemArt
                    src={e.webappImage}
                    emoji={e.emoji}
                    alt={e.name}
                    frame="ingredient"
                  />
                  <span
                    className={`max-w-[72px] truncate text-[11px] font-bold ${short ? "text-red-300" : "text-[rgba(200,168,75,0.75)]"}`}
                  >
                    ×{e.qty}
                  </span>
                </div>
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

// ── Bank hero panel — same full-bleed aspect-square language the tool
// art gets. Points at /assets/webapp/vault/bank.webp (drop the file in
// public/assets/webapp/vault/ to light it up) — same convention as
// itemRegistry.ts's items/ and craftRecipes.ts's rituals/ folders. Falls
// back to the icon + animated gold rays/coin drift treatment (no broken-
// image box) until that file exists. ───────────────────────────────────
function BankHero() {
  const [broken, setBroken] = useState(false);
  return (
    <div className="hero-panel group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden border-b border-[rgba(200,168,75,0.15)] bg-[radial-gradient(circle_at_50%_40%,rgba(200,168,75,0.14),transparent_70%)]">
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
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(200,168,75,0.35)] bg-black/50 shadow-[0_0_30px_rgba(200,168,75,0.25)] transition-transform duration-500 group-hover:scale-110">
            <Landmark className="h-9 w-9 text-ayakashi-gold" />
          </div>
          {/* drifting coin glyphs */}
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

// ── Vault hero panel — mirrors BankHero's scale. Points at
// /assets/webapp/vault/home_vault.webp normally, and
// /assets/webapp/vault/home_vault_critical.webp when health is low (drop
// both in public/assets/webapp/vault/ — the critical variant is optional,
// falls back to the normal image with a red overlay if only one exists).
// Unowned vault stays icon-only (dimmed, locked) since there's nothing to
// upgrade toward showing yet. ─────────────────────────────────────────
function VaultHero({ critical, owned }: { critical: boolean; owned: boolean }) {
  const [broken, setBroken] = useState(false);
  const [criticalBroken, setCriticalBroken] = useState(false);

  if (!owned) {
    return (
      <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden border-b border-[rgba(200,168,75,0.12)] bg-[rgba(200,168,75,0.03)] opacity-50">
        <Home className="h-12 w-12 text-[rgba(200,168,75,0.30)]" />
      </div>
    );
  }

  // Prefer the dedicated critical image; if it 404s, fall back to the
  // normal vault image (still with the red ray-sweep/overlay below) so a
  // missing critical-only asset never means a blank panel.
  const useCriticalImg = critical && !criticalBroken;
  const imgSrc = useCriticalImg
    ? "/assets/webapp/vault/home_vault_critical.webp"
    : "/assets/webapp/vault/home_vault.webp";
  const imgIsBroken = useCriticalImg ? false : broken;

  return (
    <div
      className={`hero-panel group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden border-b transition-colors duration-500 ${
        critical
          ? "border-red-500/25 bg-[radial-gradient(circle_at_50%_40%,rgba(220,60,60,0.16),transparent_70%)]"
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
            useCriticalImg ? setCriticalBroken(true) : setBroken(true)
          }
        />
      )}
      {/* critical red wash sits above the image (if any) so the danger
          state always reads even when using the normal vault art */}
      {critical && (
        <div className="pointer-events-none absolute inset-0 z-20 bg-red-500/10" />
      )}
      {imgIsBroken && (
        <>
          <div
            className={`hero-ray-sweep absolute inset-0 opacity-40 ${critical ? "hero-ray-sweep-danger" : ""}`}
          />
          <div
            className={`relative flex h-20 w-20 items-center justify-center rounded-full border transition-transform duration-500 group-hover:scale-110 ${
              critical
                ? "border-red-500/40 bg-black/50 shadow-[0_0_30px_rgba(220,60,60,0.30)]"
                : "border-[rgba(200,168,75,0.35)] bg-black/50 shadow-[0_0_30px_rgba(200,168,75,0.25)]"
            } ${critical ? "reveal-glow-pulse" : ""}`}
          >
            <Home
              className={`h-9 w-9 ${critical ? "text-red-400" : "text-ayakashi-gold"}`}
            />
          </div>
        </>
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
            {toolsData?.tools.map((tool, i) => (
              <ToolCard
                key={tool.tool}
                tool={tool}
                index={i}
                hasCraftingTable={toolsData.hasCraftingTable}
                haveOf={haveOf}
                haveRyo={dashData?.currency.ryo ?? 0}
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
          <div className="craft-card vault-card-in flex flex-col overflow-hidden rounded-xl">
            <BankHero />
            <div className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                  Bank
                </h2>
                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                  Safe ryo storage · never robbable
                </p>
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
          </div>

          {/* Vault */}
          <div
            className={`craft-card vault-card-in flex flex-col overflow-hidden rounded-xl transition-colors duration-300 ${
              !vault
                ? "craft-card-locked"
                : vaultCritical
                  ? "border-red-500/30"
                  : ""
            }`}
            style={{ animationDelay: "90ms" }}
          >
            <VaultHero critical={vaultCritical} owned={!!vault} />
            <div className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                  Home Vault
                </h2>
                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                  Higher yield · can be robbed
                </p>
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
