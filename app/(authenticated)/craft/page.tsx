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
} from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";
import { CurrencyIcon } from "../../components/CurrencyIcon";

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

// ── Item art — image with emoji fallback ────────────────────────────
function ItemArt({
  src,
  emoji,
  alt,
  size = 64,
  rarity,
  className = "",
}: {
  src?: string;
  emoji: string;
  alt: string;
  size?: number;
  rarity?: Rarity;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-lg bg-black/40 ${rarityRing(rarity)} ${className}`}
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

// ── Material chip ────────────────────────────────────────────────────
function MaterialChip({ input }: { input: CraftInput }) {
  const enough = input.have >= input.qty;
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
        enough
          ? "border-[rgba(200,168,75,0.20)] bg-white/[0.02]"
          : "chip-short border-red-500/35 bg-red-500/5"
      }`}
    >
      <ItemArt
        src={input.webappImage}
        emoji={input.emoji}
        alt={input.displayName}
        size={38}
        rarity={input.rarity}
      />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[11px] text-[#f0e6c8]">
          {input.displayName}
        </span>
        <span
          className={`text-[10px] font-bold tabular-nums ${enough ? "text-[rgba(200,168,75,0.55)]" : "text-red-400"}`}
        >
          {input.have} / {input.qty}
        </span>
      </div>
    </div>
  );
}

// ── Recipe card ───────────────────────────────────────────────────
function RecipeCard({
  recipe,
  hasCraftingTable,
  onCraft,
  busy,
}: {
  recipe: CraftRecipe;
  hasCraftingTable: boolean;
  onCraft: (recipe: CraftRecipe) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const locked = !hasCraftingTable;
  const owned = recipe.alreadyOwnsTool;
  const unavailable = locked || owned || !recipe.canAfford;
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
      className={`craft-card item-card-lift flex flex-col gap-4 rounded-xl p-4 ${locked ? "craft-card-locked" : ""} ${expanded ? "is-expanded" : ""}`}
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
      {/* Header row: output art + name + risk badge */}
      <div className="flex items-start gap-3">
        <ItemArt
          src={cardArt}
          emoji={outputEmoji}
          alt={outputLabel}
          size={64}
          rarity={recipe.outputRarity}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-sm font-bold text-[#f0e6c8]">
            {recipe.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
            Yields {outputAmountText}{" "}
            {recipe.output.type === "kitsu" ? "" : outputEmoji} {outputLabel}
          </p>
        </div>
        {risky && (
          <span className="shrink-0 rounded border border-red-500/35 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-400">
            {recipe.successRate}%
          </span>
        )}
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
          <MaterialChip key={input.itemId} input={input} />
        ))}
      </div>

      {/* Ryo cost */}
      {recipe.ryoCost > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-[rgba(200,168,75,0.65)]">
          <CurrencyIcon type="ryo" size={14} />
          <span className="font-bold tabular-nums">{fmt(recipe.ryoCost)}</span>
          <span className="text-[rgba(200,168,75,0.40)]">ryo</span>
        </div>
      )}

      {owned && (
        <p className="flex items-center gap-1.5 text-xs text-green-400/80">
          <CheckCircle2 className="h-3.5 w-3.5" /> Already crafted
        </p>
      )}
      {locked && (
        <p className="flex items-center gap-1.5 text-xs text-[rgba(200,168,75,0.40)]">
          <Lock className="h-3.5 w-3.5" /> Requires Crafting Table
        </p>
      )}

      <button
        type="button"
        disabled={unavailable || busy}
        onClick={(e) => {
          e.stopPropagation();
          onCraft(recipe);
        }}
        className="h-9 rounded-md border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.18)] disabled:text-[rgba(200,168,75,0.22)] disabled:hover:bg-transparent"
      >
        {busy
          ? "Crafting…"
          : owned
            ? "Already Owned"
            : risky
              ? "Attempt Ritual"
              : "Craft"}
      </button>
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

// ── Craft modal: roll -> reveal ──────────────────────────────────────
type ModalPhase = "rolling" | "success" | "fail" | "error";

function CraftModal({
  recipe,
  onClose,
  onSettled,
}: {
  recipe: CraftRecipe;
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
    const minRollTime = new Promise((r) => setTimeout(r, 1150));

    (async () => {
      try {
        const [res] = await Promise.all([
          executeCraft(recipe.recipeId),
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
  }, [recipe.recipeId]);

  const outputEmoji =
    recipe.output.type === "kitsu" ? "🔥" : (recipe.outputEmoji ?? "");
  // Same priority as the card: ritual's own art first, then the output
  // item's registry art — previously this only ever checked the item
  // path, so every kitsu-yielding ritual's modal fell back to emoji.
  const modalArt = recipe.webappImage ?? recipe.outputWebappImage;

  const canDismiss = phase !== "rolling";

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
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div className="rune-spin absolute inset-0 rounded-full border-2 border-dashed border-[rgba(200,168,75,0.35)]" />
              <div className="rune-spin-reverse absolute inset-3 rounded-full border border-[rgba(200,168,75,0.20)]" />
              {modalArt ? (
                <ItemArt
                  src={modalArt}
                  emoji={outputEmoji}
                  alt={recipe.name}
                  size={72}
                  rarity={recipe.outputRarity}
                  className="opacity-70"
                />
              ) : (
                <span className="text-4xl">{outputEmoji || "✦"}</span>
              )}
            </div>
            <div>
              <p className="font-display text-sm font-bold tracking-wide text-[#f0e6c8]">
                {recipe.successRate < 100 ? "Working the ritual…" : "Crafting…"}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                {recipe.name}
              </p>
            </div>
          </>
        )}

        {phase === "success" && result && (
          <>
            <div className="reveal-pop relative flex h-28 w-28 items-center justify-center">
              <div className="reveal-glow-pulse absolute inset-0 rounded-full bg-[#c8a84b]/20 blur-xl" />
              {modalArt ? (
                <ItemArt
                  src={modalArt}
                  emoji={outputEmoji}
                  alt={recipe.name}
                  size={96}
                  rarity={recipe.outputRarity}
                />
              ) : (
                <span className="text-6xl">{outputEmoji || "✦"}</span>
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
              <p className="font-display text-lg font-bold tracking-wide text-[#e6c96a]">
                Success!
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

  const openCraft = (recipe: CraftRecipe) => {
    setBusyId(recipe.recipeId);
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
              {toolRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.recipeId}
                  recipe={recipe}
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
            subtitle="Kitsu transmutations & bag upgrades"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ritualRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.recipeId}
                  recipe={recipe}
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
          onClose={closeModal}
          onSettled={handleSettled}
        />
      )}
    </>
  );
}
