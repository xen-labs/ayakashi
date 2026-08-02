"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Hammer } from "lucide-react";
import {
  getCraftRecipes,
  executeCraft,
  ApiResponseError,
} from "../../../lib/api";
import type { CraftRecipesResponse, CraftRecipe } from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";
import { CurrencyIcon } from "../../components/CurrencyIcon";

function fmt(n: number) {
  return n.toLocaleString("en-US");
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
  onCraft: (id: string) => void;
  busy: boolean;
}) {
  const locked = !hasCraftingTable;
  const unavailable = locked || recipe.alreadyOwnsTool || !recipe.canAfford;

  return (
    <div className={`form-card flex flex-col gap-4 border p-5 ${locked ? "opacity-40" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-bold text-[#f0e6c8]">{recipe.label}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
            Output: {recipe.output.amount}× {recipe.output.itemId}
          </p>
        </div>
        {recipe.successRate < 100 && (
          <span className="shrink-0 border border-[rgba(200,168,75,0.25)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)]">
            {recipe.successRate}% chance
          </span>
        )}
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">Requires</p>
        {recipe.inputs.map((input) => {
          const enough = input.have >= input.qty;
          return (
            <div key={input.itemId} className="flex items-center justify-between text-xs">
              <span className="text-[#f0e6c8]">{input.itemId}</span>
              <span className={`font-bold tabular-nums ${enough ? "text-green-400" : "text-red-400"}`}>
                {input.have} / {input.qty}
              </span>
            </div>
          );
        })}
      </div>

      {/* Ryo cost */}
      {recipe.ryoCost > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-[rgba(200,168,75,0.60)]">
          <CurrencyIcon type="ryo" size={13} />
          <span>{fmt(recipe.ryoCost)} ryo</span>
        </div>
      )}

      {/* States */}
      {recipe.alreadyOwnsTool && (
        <p className="flex items-center gap-1 text-xs text-[rgba(200,168,75,0.45)]">
          <CheckCircle className="h-3.5 w-3.5 text-green-400" /> Already crafted
        </p>
      )}
      {locked && (
        <p className="text-xs text-[rgba(200,168,75,0.40)]">Requires Crafting Table</p>
      )}

      <button
        type="button"
        disabled={unavailable || busy}
        onClick={() => onCraft(recipe.recipeId)}
        className="h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
      >
        {busy ? "Crafting…" : recipe.alreadyOwnsTool ? "Already Owned" : "Craft"}
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function CraftPage() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();

  const [data, setData] = useState<CraftRecipesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getCraftRecipes();
      setData(res);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setError("Couldn't load craft recipes. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCraft = async (recipeId: string) => {
    setBusyId(recipeId);
    try {
      const res = await executeCraft(recipeId);
      if (res.success) {
        setToast({ msg: `✦ Craft succeeded! Got ${res.output?.amount ?? 1}× ${res.output?.itemId ?? "item"}`, ok: true });
      } else {
        setToast({ msg: res.message ?? "Craft failed — better luck next time!", ok: false });
      }
      await load();
      refreshCurrency();
    } catch (err) {
      setToast({
        msg: err instanceof ApiResponseError ? err.error.message : "Craft failed.",
        ok: false,
      });
    } finally {
      setBusyId(null);
    }
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
      <p className="text-sm text-[rgba(200,168,75,0.60)]">{error}</p>
      <button type="button" onClick={load} className="brush-btn w-40">Retry</button>
    </div>
  );

  return (
    <>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

        <div className="section-header">
          <span className="section-header-text">Craft</span>
        </div>

        <hr className="gold-rule" />

        {/* Crafting table warning */}
        {data && !data.hasCraftingTable && (
          <div className="flex items-center gap-3 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            You need a <strong>Crafting Table</strong> to craft anything. Buy one from the Shop.
          </div>
        )}

        {data?.hasCraftingTable && (
          <div className="flex items-center gap-3 border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            <Hammer className="h-4 w-4 shrink-0" />
            Crafting Table active — all recipes available.
          </div>
        )}

        {/* Recipe grid */}
        {data?.recipes.length === 0 ? (
          <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">No craft recipes available.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.recipes.map((recipe) => (
              <RecipeCard
                key={recipe.recipeId}
                recipe={recipe}
                hasCraftingTable={data.hasCraftingTable}
                onCraft={handleCraft}
                busy={busyId === recipe.recipeId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 border px-5 py-3 text-sm font-bold shadow-lg lg:bottom-6 ${
          toast.ok
            ? "border-[#c8a84b] bg-black/95 text-[#c8a84b] shadow-[0_0_25px_rgba(200,168,75,0.35)]"
            : "border-red-500/50 bg-black/95 text-red-400"
        }`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
