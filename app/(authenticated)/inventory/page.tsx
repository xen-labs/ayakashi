"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getInventory, sellItem, ApiResponseError } from "../../../lib/api";
import type { InventoryItem, ItemCategory } from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";

// ── Category tab config ────────────────────────────────────────────
const CATEGORY_TABS: { id: ItemCategory | "all"; label: string }[] = [
  { id: "all",           label: "All"        },
  { id: "material",      label: "Materials"  },
  { id: "rob_gear",      label: "Rob Gear"   },
  { id: "consumable",    label: "Consumables"},
  { id: "vault_upgrade", label: "Upgrades"   },
  { id: "tool",          label: "Tools"      },
];

const RARITY_COLOR: Record<string, string> = {
  common:    "text-[rgba(200,168,75,0.40)]",
  uncommon:  "text-green-400",
  rare:      "text-blue-400",
  epic:      "text-purple-400",
  legendary: "text-[#e6c96a]",
};

function formatNumber(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

// ── Durability label ───────────────────────────────────────────────
function durabilityLabel(item: InventoryItem): string | null {
  if (!item.durability) return null;
  const map: Record<string, string> = {
    permanent:        "Permanent",
    "single-use":     "Single Use",
    "shatter-on-fail":"Shatters on Fail",
    charges:          item.maxCharges ? `${item.maxCharges} Charges` : "Charges",
  };
  return map[item.durability] ?? item.durability;
}

// ── Single item card ───────────────────────────────────────────────
function ItemCard({
  item,
  onSell,
}: {
  item: InventoryItem;
  onSell: (item: InventoryItem) => void;
}) {
  const dur = durabilityLabel(item);
  const isMaterial = item.category === "material";

  return (
    <div className="form-card flex flex-col gap-3 border p-4 transition-all hover:border-[rgba(200,168,75,0.45)]">
      {/* header */}
      <div className="flex items-start gap-3">
        {/* image or emoji fallback */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-[rgba(200,168,75,0.20)] bg-[rgba(200,168,75,0.05)]">
          {item.webappImage ? (
            <Image
              src={item.webappImage}
              alt={item.name}
              fill
              className="object-contain p-1"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl">{item.emoji}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-[#f0e6c8] leading-tight">{item.name}</span>
            <span className="text-lg leading-none">{item.emoji}</span>
          </div>
          {item.rarity && (
            <span className={`text-[10px] font-bold uppercase tracking-widest ${RARITY_COLOR[item.rarity] ?? ""}`}>
              {item.rarity}
            </span>
          )}
        </div>
        {/* qty badge */}
        <span className="shrink-0 border border-[rgba(200,168,75,0.30)] bg-[rgba(200,168,75,0.08)] px-2.5 py-1 text-sm font-bold text-[#e6c96a] tabular-nums">
          ×{item.quantity}
        </span>
      </div>

      {/* flavor */}
      {item.flavor && (
        <p className="text-[11px] italic leading-5 text-[rgba(200,168,75,0.42)] line-clamp-2">{item.flavor}</p>
      )}

      {/* meta row */}
      <div className="flex flex-wrap items-center gap-2">
        {dur && (
          <span className="border border-[rgba(200,168,75,0.22)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
            {dur}
          </span>
        )}
        {item.toolLevel != null && (
          <span className="border border-blue-500/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-blue-400">
            Lvl {item.toolLevel}
          </span>
        )}
        {item.sellPrice != null && (
          <span className="ml-auto text-xs font-bold text-[rgba(200,168,75,0.55)]">
            🪙 {formatNumber(item.sellPrice)} / ea
          </span>
        )}
      </div>

      {/* tool upgrade hint */}
      {item.toolLevel != null && item.nextLevelCost && (
        <p className="text-[10px] text-[rgba(200,168,75,0.35)] uppercase tracking-wider">
          Upgrade: {item.nextLevelCost.ryo.toLocaleString()} ryo + {item.nextLevelCost.materialQty} materials
        </p>
      )}

      {/* sell button — materials only */}
      {isMaterial && item.sellPrice != null && (
        <button
          type="button"
          onClick={() => onSell(item)}
          className="mt-1 h-8 border border-[rgba(200,168,75,0.35)] text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-colors hover:border-[#c8a84b] hover:bg-[rgba(200,168,75,0.08)] hover:text-[#c8a84b]"
        >
          Sell
        </button>
      )}
    </div>
  );
}

// ── Sell confirm modal ─────────────────────────────────────────────
function SellModal({
  item,
  onClose,
  onConfirm,
  submitting,
  error,
}: {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (qty: number) => void;
  submitting: boolean;
  error: string;
}) {
  const [qty, setQty] = useState(1);
  const total = (item.sellPrice ?? 0) * qty;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-6 flex flex-col gap-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
          Sell {item.emoji} {item.name}
        </h2>
        <p className="text-xs text-[rgba(200,168,75,0.50)]">
          You have ×{item.quantity}. Price: {formatNumber(item.sellPrice)} ryo each.
        </p>

        {/* qty */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">Quantity</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-8 w-8 border border-[rgba(200,168,75,0.25)] text-[#f0e6c8] hover:border-[#c8a84b] hover:text-[#c8a84b]">−</button>
            <input type="number" value={qty} min={1} max={item.quantity}
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setQty(Math.min(item.quantity, Math.max(1, v))); }}
              className="form-input h-8 w-16 border text-center outline-none" />
            <button type="button" onClick={() => setQty((q) => Math.min(item.quantity, q + 1))}
              className="h-8 w-8 border border-[rgba(200,168,75,0.25)] text-[#f0e6c8] hover:border-[#c8a84b] hover:text-[#c8a84b]">+</button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[rgba(200,168,75,0.12)] pt-3">
          <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.55)]">You receive</span>
          <span className="text-lg font-bold text-[#e6c96a]">🪙 {formatNumber(total)}</span>
        </div>

        {error && <p className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 h-10 border border-[rgba(200,168,75,0.25)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)] hover:border-[rgba(200,168,75,0.55)]">
            Cancel
          </button>
          <button type="button" disabled={submitting} onClick={() => onConfirm(qty)}
            className="flex-1 h-10 border border-[#c8a84b] bg-[#c8a84b] text-xs font-bold uppercase tracking-widest text-black hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? "Selling…" : "Confirm Sell"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Inventory() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ItemCategory | "all">("all");
  const [sellTarget, setSellTarget] = useState<InventoryItem | null>(null);
  const [selling, setSelling] = useState(false);
  const [sellError, setSellError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getInventory();
      setItems(res.items);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setError("Couldn't load your inventory. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSell = async (qty: number) => {
    if (!sellTarget) return;
    setSelling(true); setSellError("");
    try {
      const res = await sellItem({ itemId: sellTarget.itemId, quantity: qty });
      setItems((prev) =>
        prev
          .map((i) =>
            i.itemId === sellTarget.itemId
              ? { ...i, quantity: i.quantity - qty }
              : i,
          )
          .filter((i) => i.quantity > 0),
      );
      refreshCurrency();
      setToast(`+${res.ryoEarned.toLocaleString()} 🪙 from ${sellTarget.name}`);
      setSellTarget(null);
    } catch (err) {
      setSellError(err instanceof ApiResponseError ? err.error.message : "Sell failed. Try again.");
    } finally {
      setSelling(false);
    }
  };

  // Tabs only for categories that actually have items
  const presentCategories = new Set(items.map((i) => i.category));
  const visibleTabs = CATEGORY_TABS.filter(
    (t) => t.id === "all" || presentCategories.has(t.id as ItemCategory),
  );

  const filtered =
    activeTab === "all" ? items : items.filter((i) => i.category === activeTab);

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

  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">

        <div className="section-header">
          <span className="section-header-text">Inventory</span>
        </div>

        <hr className="gold-rule" />

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="text-4xl opacity-30">🎒</span>
            <p className="text-sm text-[rgba(200,168,75,0.40)]">Your inventory is empty.</p>
          </div>
        ) : (
          <>
            {/* ── Category tabs ── */}
            {visibleTabs.length > 1 && (
              <div className="flex gap-0 overflow-x-auto border-b border-[rgba(200,168,75,0.15)] scrollbar-none">
                {visibleTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`relative shrink-0 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                      activeTab === t.id
                        ? "text-[#c8a84b]"
                        : "text-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.70)]"
                    }`}
                  >
                    {t.label}
                    {activeTab === t.id && (
                      <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.6)]" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── Item count ── */}
            <p className="text-[11px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </p>

            {/* ── Grid ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <ItemCard key={item.itemId} item={item} onSell={setSellTarget} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Sell modal */}
      {sellTarget && (
        <SellModal
          item={sellTarget}
          onClose={() => { setSellTarget(null); setSellError(""); }}
          onConfirm={handleSell}
          submitting={selling}
          error={sellError}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 border border-[#c8a84b] bg-black/95 px-5 py-3 text-sm font-bold text-[#c8a84b] shadow-[0_0_25px_rgba(200,168,75,0.35)] animate-[shop-toast-in_0.3s_ease-out]">
          ✦ {toast}
        </div>
      )}
    </>
  );
}
