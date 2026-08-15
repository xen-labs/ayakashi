"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  Hammer,
  Flame,
  Lock,
  CheckCircle2,
  Minus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  getCraftRecipes,
  executeCraft,
  ApiResponseError,
} from "../../../lib/api";
import type {
  CraftRecipesResponse,
  CraftRecipe,
  CraftInput,
  CraftResponse,
  CraftRoll,
} from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";
import { CurrencyIcon } from "../../components/CurrencyIcon";

const MAX_CRAFT_QTY = 20;

function fmt(n: number | undefined | null) {
  return (n ?? 0).toLocaleString("en-US");
}

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | undefined;

function rarityRing(r: Rarity) {
  switch (r) {
    case "uncommon":
      return "rarity-ring-uncommon";
    case "rare":
      return "rarity-ring-rare";
    case "epic":
      return "rarity-ring-epic";
    case "legendary":
      return "rarity-ring-legendary";
    default:
      return "rarity-ring-common";
  }
}

function outputRange(recipe: CraftRecipe): { min: number; max: number } | null {
  const o = recipe.output;
  if (o.type === "kitsu" && "min" in o) return { min: o.min, max: o.max };
  return null;
}

// ── Item art — hero frame, same language as the Upgrade page's ItemArt:
// a full-width aspect-square panel with a soft gradient backdrop and a
// bottom hairline separating it from the card body, instead of a small
// boxed thumbnail. `frame="thumb"` keeps the old compact form for spots
// that still need it (material chips). Rarity now reads as a glow behind
// the art rather than a hard ring boxing it in. ─────────────────────────
function ItemArt({
  src,
  emoji,
  alt,
  rarity,
  frame = "hero",
}: {
  src?: string;
  emoji: string;
  alt: string;
  rarity?: Rarity;
  frame?: "hero" | "thumb";
}) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  const isThumb = frame === "thumb";

  if (isThumb) {
    return (
      <div
        className={`relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-black/40 ${rarityRing(rarity)}`}
      >
        {showImg ? (
          <Image
            src={src}
            alt={alt}
            width={38}
            height={38}
            className="object-contain p-1"
            unoptimized
            onError={() => setBroken(true)}
          />
        ) : (
          <span style={{ fontSize: 19 }}>{emoji}</span>
        )}
      </div>
    );
  }

  return (
    <div className="group relative aspect-square w-full overflow-hidden border-b border-[rgba(200,168,75,0.12)] bg-[rgba(200,168,75,0.04)]">
      {/* rarity glow wash behind the art, replaces the old boxed ring */}
      {rarity && rarity !== "common" && (
        <div
          className={`pointer-events-none absolute inset-0 opacity-60 blur-2xl ${
            rarity === "legendary"
              ? "bg-[radial-gradient(circle_at_50%_45%,rgba(230,180,80,0.35),transparent_65%)]"
              : rarity === "epic"
                ? "bg-[radial-gradient(circle_at_50%_45%,rgba(190,120,230,0.30),transparent_65%)]"
                : rarity === "rare"
                  ? "bg-[radial-gradient(circle_at_50%_45%,rgba(110,160,230,0.28),transparent_65%)]"
                  : "bg-[radial-gradient(circle_at_50%_45%,rgba(120,200,140,0.25),transparent_65%)]"
          }`}
        />
      )}
      {showImg ? (
        <Image
          src={src}
          alt={alt}
          width={280}
          height={280}
          className="relative mx-auto h-[80%] w-[80%] object-contain p-2 drop-shadow-[0_4px_20px_rgba(200,168,75,0.35)] transition-transform duration-300 group-hover:scale-[1.08]"
          unoptimized
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="relative flex h-full items-center justify-center text-7xl leading-none transition-transform duration-300 group-hover:scale-110 select-none">
          {emoji}
        </span>
      )}
    </div>
  );
}

// ── Material chip ────────────────────────────────────────────────────
function MaterialChip({
  input,
  qtyMultiplier = 1,
}: {
  input: CraftInput;
  qtyMultiplier?: number;
}) {
  const need = input.qty * qtyMultiplier;
  const enough = input.have >= need;
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors duration-200 ${
        enough
          ? "border-[rgba(200,168,75,0.20)] bg-white/[0.02]"
          : "chip-short border-red-500/35 bg-red-500/5"
      }`}
    >
      <ItemArt
        src={input.webappImage}
        emoji={input.emoji}
        alt={input.displayName}
        rarity={input.rarity}
        frame="thumb"
      />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[11px] text-[#f0e6c8]">
          {input.displayName}
        </span>
        <span
          className={`text-[10px] font-bold tabular-nums ${enough ? "text-[rgba(200,168,75,0.55)]" : "text-red-400"}`}
        >
          {input.have} / {need}
        </span>
      </div>
    </div>
  );
}

// ── Qty stepper — bulk craft control ───────────────────────────────
function QtyStepper({
  qty,
  max,
  onChange,
}: {
  qty: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const step = (delta: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(Math.min(max, Math.max(1, qty + delta)));
  };
  const presets = [1, 5, 10, Math.min(20, max)].filter(
    (v, i, arr) => v <= max && arr.indexOf(v) === i,
  );

  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center overflow-hidden rounded-md border border-[rgba(200,168,75,0.25)]">
        <button
          type="button"
          onClick={step(-1)}
          disabled={qty <= 1}
          className="flex h-8 w-8 items-center justify-center text-[#c8a84b] transition-colors hover:bg-[rgba(200,168,75,0.12)] disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-9 text-center text-sm font-bold tabular-nums text-[#f0e6c8]">
          {qty}
        </span>
        <button
          type="button"
          onClick={step(1)}
          disabled={qty >= max}
          className="flex h-8 w-8 items-center justify-center text-[#c8a84b] transition-colors hover:bg-[rgba(200,168,75,0.12)] disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(p);
            }}
            className={`rounded px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
              qty === p
                ? "bg-[#c8a84b] text-black"
                : "text-[rgba(200,168,75,0.55)] hover:bg-[rgba(200,168,75,0.10)]"
            }`}
          >
            {p === max && max !== 20 ? "max" : `${p}×`}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Recipe card ───────────────────────────────────────────────────
function RecipeCard({
  recipe,
  index,
  hasCraftingTable,
  onCraft,
  busy,
}: {
  recipe: CraftRecipe;
  index: number;
  hasCraftingTable: boolean;
  onCraft: (recipe: CraftRecipe, qty: number) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const locked = !hasCraftingTable;
  const owned = recipe.alreadyOwnsTool;
  const bulkable = !owned; // tool first-crafts are always qty-locked to 1
  const [qty, setQty] = useState(1);

  // Max qty this player can currently afford across every material +
  // ryo — recomputed whenever inputs/ryo/qty context changes. Capped by
  // the server's MAX_CRAFT_QTY regardless of how much they could afford.
  const maxAffordableQty = useMemo(() => {
    if (!bulkable) return 1;
    const byMaterials = recipe.inputs.map((i) =>
      i.qty > 0 ? Math.floor(i.have / i.qty) : MAX_CRAFT_QTY,
    );
    const capped = Math.min(MAX_CRAFT_QTY, ...byMaterials);
    return Math.max(0, capped);
  }, [recipe.inputs, bulkable]);

  const canAffordAtQty = recipe.canAfford && maxAffordableQty >= qty;
  const unavailable = locked || owned || !canAffordAtQty;
  const risky = recipe.successRate < 100;
  const range = outputRange(recipe);

  const outputLabel =
    recipe.output.type === "kitsu"
      ? "Kitsu"
      : (recipe.outputDisplayName ?? recipe.output.itemId ?? "item");
  const outputEmoji =
    recipe.output.type === "kitsu" ? "🔥" : (recipe.outputEmoji ?? "");
  const outputAmountText =
    recipe.output.type === "kitsu"
      ? range
        ? `${range.min}\u2013${range.max}`
        : `${(recipe.output as { amount: number }).amount}`
      : `${(recipe.output as { amount: number }).amount}×`;

  // Art priority: the recipe's own art (rituals, set in craftRecipes.ts)
  // first, then the output item's registry art (tool/bag crafts), then
  // the emoji fallback inside ItemArt itself.
  const cardArt = recipe.webappImage ?? recipe.outputWebappImage;

  return (
    <div
      className={`craft-card item-card-lift group flex flex-col overflow-hidden rounded-xl [animation:shop-card-in_0.35s_ease-out_backwards] ${locked ? "craft-card-locked" : ""} ${expanded ? "is-expanded" : ""}`}
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
    >
      {/* Hero art panel — full width, upgrade-page scale */}
      <div className="relative">
        <ItemArt
          src={cardArt}
          emoji={outputEmoji}
          alt={outputLabel}
          rarity={recipe.outputRarity}
        />
        {risky && (
          <span className="absolute right-2 top-2 rounded border border-red-500/40 bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-400 backdrop-blur-sm">
            {recipe.successRate}% success
          </span>
        )}
        {owned && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded border border-green-500/40 bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-green-400 backdrop-blur-sm">
            <CheckCircle2 className="h-3 w-3" /> Owned
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="font-display truncate text-sm font-bold text-[#f0e6c8]">
            {recipe.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
            Yields {outputAmountText}{" "}
            {recipe.output.type === "kitsu" ? "" : outputEmoji} {outputLabel}
            {qty > 1 && bulkable && (
              <span className="text-[#e6c96a]"> × {qty}</span>
            )}
          </p>
        </div>

        {/* Description — collapsed preview, tap the card to read in full */}
        {recipe.description && (
          <>
            <div className="item-card-reveal">
              <div>
                <p className="pt-0.5 text-[11px] leading-relaxed text-[rgba(200,168,75,0.55)]">
                  {recipe.description}
                </p>
              </div>
            </div>
            {!expanded && (
              <p className="line-clamp-1 text-[11px] leading-relaxed text-[rgba(200,168,75,0.40)]">
                {recipe.description}{" "}
                <span className="text-[rgba(200,168,75,0.30)]">
                  — tap to read
                </span>
              </p>
            )}
          </>
        )}

        {/* Materials */}
        <div className="grid grid-cols-2 gap-1.5">
          {recipe.inputs.map((input) => (
            <MaterialChip
              key={input.itemId}
              input={input}
              qtyMultiplier={bulkable ? qty : 1}
            />
          ))}
        </div>

        {/* Ryo cost */}
        {recipe.ryoCost > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[rgba(200,168,75,0.65)]">
            <CurrencyIcon type="ryo" size={14} />
            <span className="font-bold tabular-nums">
              {fmt(recipe.ryoCost * (bulkable ? qty : 1))}
            </span>
            <span className="text-[rgba(200,168,75,0.40)]">
              ryo{qty > 1 && bulkable ? ` (${fmt(recipe.ryoCost)} ea)` : ""}
            </span>
          </div>
        )}

        {locked && (
          <p className="flex items-center gap-1.5 text-xs text-[rgba(200,168,75,0.40)]">
            <Lock className="h-3.5 w-3.5" /> Requires Crafting Table
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {/* Bulk qty stepper — only for non-tool recipes with room to
              craft at least one at current inventory levels */}
          {bulkable && !locked && !owned && maxAffordableQty > 0 && (
            <QtyStepper
              qty={qty}
              max={Math.max(1, maxAffordableQty)}
              onChange={setQty}
            />
          )}

          <button
            type="button"
            disabled={unavailable || busy}
            onClick={(e) => {
              e.stopPropagation();
              onCraft(recipe, bulkable ? qty : 1);
            }}
            className="h-9 rounded-md border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.18)] disabled:text-[rgba(200,168,75,0.22)] disabled:hover:bg-transparent"
          >
            {busy
              ? "Crafting…"
              : owned
                ? "Already Owned"
                : risky
                  ? qty > 1
                    ? `Attempt Ritual × ${qty}`
                    : "Attempt Ritual"
                  : qty > 1
                    ? `Craft × ${qty}`
                    : "Craft"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────
function CraftSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(200,168,75,0.30)] bg-black/50 text-[#c8a84b]">
          {icon}
        </div>
        <div>
          <p className="font-display text-base font-bold tracking-wide text-[#f0e6c8]">
            {title}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Circular hero art — used only in the modal reveal moment. Distinct
// from the card's ItemArt: no square frame, no bottom hairline — just
// the art floating inside a soft circular glow, ringed by the rarity
// color as a genuine halo instead of a boxed outline. This replaces the
// old approach of reusing the square card ItemArt at 128px, which read
// as an odd frame-within-a-frame in the reveal modal. ──────────────────
function RevealArt({
  src,
  emoji,
  alt,
  rarity,
  size = 128,
}: {
  src?: string;
  emoji: string;
  alt: string;
  rarity?: Rarity;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  const glow =
    rarity === "legendary"
      ? "rgba(230,180,80,0.55)"
      : rarity === "epic"
        ? "rgba(190,120,230,0.5)"
        : rarity === "rare"
          ? "rgba(110,160,230,0.5)"
          : rarity === "uncommon"
            ? "rgba(120,200,140,0.45)"
            : "rgba(200,168,75,0.4)";
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      <div
        className="reveal-glow-pulse absolute inset-0 rounded-full blur-xl"
        style={{ background: glow }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: `0 0 0 1px ${glow}` }}
      />
      {showImg ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="relative z-10 object-contain p-3 drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          unoptimized
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          className="relative z-10 leading-none select-none"
          style={{ fontSize: size * 0.42 }}
        >
          {emoji}
        </span>
      )}
    </div>
  );
}

// ── Bulk roll strip — a row of small pip results (✓ / ✗) for qty > 1
// crafts, staggered in so they read left-to-right like dice landing. ──
function RollStrip({ rolls }: { rolls: CraftRoll[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {rolls.map((r, i) => (
        <div
          key={i}
          className={`roll-pip flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${
            r.success
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-red-500/35 bg-red-500/10 text-red-400"
          }`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {r.success ? "✓" : "✗"}
        </div>
      ))}
    </div>
  );
}

// ── Craft modal: roll -> reveal ──────────────────────────────────────
type ModalPhase = "rolling" | "success" | "fail" | "error";

function CraftModal({
  recipe,
  qty,
  onClose,
  onSettled,
}: {
  recipe: CraftRecipe;
  qty: number;
  onClose: () => void;
  onSettled: (res: CraftResponse | null, err?: string) => void;
}) {
  const [phase, setPhase] = useState<ModalPhase>("rolling");
  const [result, setResult] = useState<CraftResponse | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    // Bulk crafts get a slightly longer minimum roll time so the roll
    // strip has room to feel like it's resolving multiple attempts
    // rather than blinking past a batch of five in the same 1.15s a
    // single craft gets.
    const minRollTime = new Promise((r) =>
      setTimeout(r, qty > 1 ? 1450 : 1150),
    );

    (async () => {
      try {
        const [res] = await Promise.all([
          executeCraft(recipe.recipeId, qty),
          minRollTime,
        ]);
        if (cancelled) return;
        setResult(res);
        setPhase(res.success ? "success" : "fail");
        onSettled(res);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiResponseError
            ? err.error.message
            : "Something went wrong.";
        setErrMsg(msg);
        setPhase("error");
        onSettled(null, msg);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.recipeId, qty]);

  const outputEmoji =
    recipe.output.type === "kitsu" ? "🔥" : (recipe.outputEmoji ?? "");
  const modalArt = recipe.webappImage ?? recipe.outputWebappImage;
  const canDismiss = phase !== "rolling";
  const isBulk = qty > 1;
  const isPartial =
    isBulk &&
    result?.successCount != null &&
    result.successCount > 0 &&
    (result.failCount ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
      onClick={() => canDismiss && onClose()}
    >
      <div
        className="craft-modal-pop form-card relative flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {canDismiss && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-[rgba(200,168,75,0.40)] hover:text-[#c8a84b]"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {phase === "rolling" && (
          <>
            <div className="relative flex h-32 w-32 items-center justify-center">
              <div className="rune-spin absolute inset-0 rounded-full border-2 border-dashed border-[rgba(200,168,75,0.35)]" />
              <div className="rune-spin-reverse absolute inset-3 rounded-full border border-[rgba(200,168,75,0.20)]" />
              <RevealArt
                src={modalArt}
                emoji={outputEmoji || "✦"}
                alt={recipe.name}
                rarity={recipe.outputRarity}
                size={92}
              />
              {/* ember particles swirling during the roll */}
              <span
                className="ember-particle absolute bottom-1 left-4 h-1 w-1 rounded-full bg-[#e6c96a]"
                style={{ animationDelay: "0s" }}
              />
              <span
                className="ember-particle absolute bottom-1 right-5 h-1 w-1 rounded-full bg-[#e6c96a]"
                style={{ animationDelay: "0.4s" }}
              />
              <span
                className="ember-particle absolute bottom-3 left-1/2 h-1 w-1 rounded-full bg-[#e6c96a]"
                style={{ animationDelay: "0.8s" }}
              />
            </div>
            <div>
              <p className="font-display text-sm font-bold tracking-wide text-[#f0e6c8]">
                {recipe.successRate < 100 ? "Working the ritual…" : "Crafting…"}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                {recipe.name}
                {isBulk && ` × ${qty}`}
              </p>
            </div>
          </>
        )}

        {phase === "success" && result && (
          <>
            <div className="reveal-pop relative flex h-36 w-36 items-center justify-center">
              <RevealArt
                src={modalArt}
                emoji={outputEmoji || "✦"}
                alt={recipe.outputDisplayName ?? recipe.name}
                rarity={recipe.outputRarity}
                size={128}
              />
              {/* celebratory sparkle burst on a clean success */}
              {!isPartial && (
                <>
                  <Sparkles className="spark-burst absolute -right-1 -top-1 h-5 w-5 text-[#e6c96a]" />
                  <Sparkles
                    className="spark-burst absolute -bottom-1 -left-1 h-4 w-4 text-[#e6c96a]"
                    style={{ animationDelay: "0.15s" }}
                  />
                </>
              )}
              {/* ember particles */}
              <span
                className="ember-particle absolute bottom-0 left-3 h-1 w-1 rounded-full bg-[#e6c96a]"
                style={{ animationDelay: "0s" }}
              />
              <span
                className="ember-particle absolute bottom-0 right-4 h-1 w-1 rounded-full bg-[#e6c96a]"
                style={{ animationDelay: "0.4s" }}
              />
              <span
                className="ember-particle absolute bottom-2 left-1/2 h-1 w-1 rounded-full bg-[#e6c96a]"
                style={{ animationDelay: "0.8s" }}
              />
            </div>
            <div>
              <p
                className={`font-display text-lg font-bold tracking-wide ${isPartial ? "text-amber-400" : "text-[#e6c96a]"}`}
              >
                {isPartial ? "Partial success" : "Success!"}
              </p>
              <p className="number-tick mt-1 flex items-center justify-center gap-1.5 text-sm text-[#f0e6c8]">
                {result.output?.type === "kitsu" ? (
                  <>
                    <CurrencyIcon type="kitsu" size={16} />
                    <span className="font-bold tabular-nums">
                      +{fmt(result.output.amount)}
                    </span>
                    <span className="text-[rgba(200,168,75,0.55)]">Kitsu</span>
                  </>
                ) : (
                  <span>
                    +{result.output?.amount ?? 1}×{" "}
                    {result.output?.displayName ??
                      recipe.outputDisplayName ??
                      "item"}
                  </span>
                )}
              </p>
              {isBulk && result.rolls && (
                <div className="mt-3 flex flex-col items-center gap-1.5">
                  <RollStrip rolls={result.rolls} />
                  <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                    {result.successCount}/{qty} rituals succeeded
                  </p>
                </div>
              )}
            </div>
            <button type="button" onClick={onClose} className="brush-btn w-40">
              Nice
            </button>
          </>
        )}

        {(phase === "fail" || phase === "error") && (
          <>
            <div className="shake-fail flex h-28 w-28 items-center justify-center rounded-full border border-red-500/30 bg-red-500/5">
              <AlertCircle className="h-12 w-12 text-red-400/80" />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-wide text-red-400">
                {phase === "error" ? "Couldn't craft" : "The ritual failed"}
              </p>
              <p className="mt-1 text-xs text-[rgba(200,168,75,0.45)]">
                {phase === "error"
                  ? errMsg
                  : (result?.message ?? "All materials were consumed.")}
              </p>
              {isBulk && phase === "fail" && result?.rolls && (
                <div className="mt-3 flex flex-col items-center gap-1.5">
                  <RollStrip rolls={result.rolls} />
                </div>
              )}
            </div>
            <button type="button" onClick={onClose} className="brush-btn w-40">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function CraftPage() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();

  const [data, setData] = useState<CraftRecipesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeRecipe, setActiveRecipe] = useState<CraftRecipe | null>(null);
  const [activeQty, setActiveQty] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await getCraftRecipes();
        setData(res);
      } catch (err) {
        if (err instanceof ApiResponseError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Couldn't load craft recipes. Try refreshing.");
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    load();
  }, [load]);

  const { toolRecipes, ritualRecipes } = useMemo(() => {
    const recipes = data?.recipes ?? [];
    return {
      toolRecipes: recipes.filter(
        (r) => r.output.type === "item" && /^gear_/.test(r.output.itemId ?? ""),
      ),
      ritualRecipes: recipes.filter(
        (r) =>
          !(r.output.type === "item" && /^gear_/.test(r.output.itemId ?? "")),
      ),
    };
  }, [data]);

  const openCraft = (recipe: CraftRecipe, qty: number) => {
    setBusyId(recipe.recipeId);
    setActiveQty(qty);
    setActiveRecipe(recipe);
  };

  const closeModal = () => {
    setActiveRecipe(null);
    setBusyId(null);
  };

  const handleSettled = async () => {
    await load(true);
    refreshCurrency();
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
        <p className="text-sm text-[rgba(200,168,75,0.60)]">{error}</p>
        <button type="button" onClick={() => load()} className="brush-btn w-40">
          Retry
        </button>
      </div>
    );

  return (
    <>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="section-header">
          <span className="section-header-text">Craft</span>
        </div>

        <hr className="gold-rule" />

        {/* Crafting table status */}
        {data && !data.hasCraftingTable && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            You need a <strong className="mx-1">Crafting Table</strong> to craft
            anything. Buy one from the Shop.
          </div>
        )}
        {data?.hasCraftingTable && (
          <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            <Hammer className="h-4 w-4 shrink-0" />
            Crafting Table active — all recipes available.
          </div>
        )}

        {/* Tools */}
        {toolRecipes.length > 0 && (
          <CraftSection
            icon={<Hammer className="h-4 w-4" />}
            title="Tools"
            subtitle="One-time crafts · upgrade later"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {toolRecipes.map((recipe, i) => (
                <RecipeCard
                  key={recipe.recipeId}
                  recipe={recipe}
                  index={i}
                  hasCraftingTable={data?.hasCraftingTable ?? false}
                  onCraft={openCraft}
                  busy={busyId === recipe.recipeId}
                />
              ))}
            </div>
          </CraftSection>
        )}

        {/* Rituals */}
        {ritualRecipes.length > 0 && (
          <CraftSection
            icon={<Flame className="h-4 w-4" />}
            title="Rituals"
            subtitle="Kitsu transmutations & bag upgrades · bulk-craft up to 20×"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ritualRecipes.map((recipe, i) => (
                <RecipeCard
                  key={recipe.recipeId}
                  recipe={recipe}
                  index={toolRecipes.length + i}
                  hasCraftingTable={data?.hasCraftingTable ?? false}
                  onCraft={openCraft}
                  busy={busyId === recipe.recipeId}
                />
              ))}
            </div>
          </CraftSection>
        )}

        {toolRecipes.length === 0 && ritualRecipes.length === 0 && (
          <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
            No craft recipes available.
          </p>
        )}
      </section>

      {activeRecipe && (
        <CraftModal
          recipe={activeRecipe}
          qty={activeQty}
          onClose={closeModal}
          onSettled={handleSettled}
        />
      )}
    </>
  );
}
