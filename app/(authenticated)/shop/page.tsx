"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { X, Coins } from "lucide-react";
import {
  getMaterialShop,
  getMyMaterialPurchases,
  buyMaterial,
  getRobItemShop,
  buyRobItem,
  getDashboard,
  getInventory,
  ApiResponseError,
} from "../../../lib/api";
import type {
  MaterialShopItem,
  RobShopItem,
  DashboardResponse,
} from "../../../lib/api";

type Tab = "materials" | "rob-items";

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// ── Buy Modal ──────────────────────────────────────────────────────
interface BuyModalState {
  kind: "material" | "rob-item";
  item: MaterialShopItem | RobShopItem;
  maxQty: number;
}

function BuyModal({
  state,
  onClose,
  onConfirm,
  submitting,
  error,
}: {
  state: BuyModalState;
  onClose: () => void;
  onConfirm: (quantity: number, currency: "ryo" | "kitsu") => void;
  submitting: boolean;
  error: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [qty, setQty] = useState(1);
  const [currency, setCurrency] = useState<"ryo" | "kitsu">(
    state.kind === "material" ? "ryo" : (state.item as RobShopItem).currency,
  );

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    el.showModal();
    const handler = () => onClose();
    el.addEventListener("cancel", handler);
    return () => el.removeEventListener("cancel", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  const unitPrice =
    state.kind === "material"
      ? currency === "ryo"
        ? (state.item as MaterialShopItem).buyPriceRyo
        : (state.item as MaterialShopItem).buyPriceKitsu
      : (state.item as RobShopItem).price;

  const total = unitPrice * qty;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="m-auto w-full max-w-sm border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col"
      aria-modal="true"
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
          {state.item.emoji} {state.item.name}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close"
          className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        {/* currency toggle — materials only */}
        {state.kind === "material" && (
          <div className="flex gap-2">
            {(["ryo", "kitsu"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`flex-1 border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  currency === c
                    ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b]"
                    : "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.45)] hover:border-[rgba(200,168,75,0.35)]"
                }`}
              >
                {c === "ryo" ? "🪙 Ryo" : "🦊 Kitsu"}
              </button>
            ))}
          </div>
        )}

        {/* qty */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
            Quantity
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-8 w-8 border border-[rgba(200,168,75,0.25)] text-[#f0e6c8] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b]">
              −
            </button>
            <input
              type="number"
              value={qty}
              min={1}
              max={state.maxQty}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setQty(Math.min(state.maxQty, Math.max(1, v)));
              }}
              className="form-input h-8 w-16 border text-center outline-none"
            />
            <button type="button" onClick={() => setQty((q) => Math.min(state.maxQty, q + 1))}
              className="h-8 w-8 border border-[rgba(200,168,75,0.25)] text-[#f0e6c8] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b]">
              +
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[rgba(200,168,75,0.40)]">
          Max {state.maxQty} for this purchase
        </p>

        {/* total */}
        <div className="flex items-center justify-between border-t border-[rgba(200,168,75,0.12)] pt-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
            Total
          </span>
          <span className="text-lg font-bold text-[#e6c96a]">
            {currency === "ryo" ? "🪙" : "🦊"} {formatNumber(total)}
          </span>
        </div>

        {error && (
          <p className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={() => onConfirm(qty, currency)}
          className="h-11 w-full border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Purchasing…" : "Confirm Purchase"}
        </button>
      </div>
    </dialog>
  );
}

// ── Stock bar ──────────────────────────────────────────────────────
function StockBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const low = pct < 20;
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1 w-full overflow-hidden bg-[rgba(200,168,75,0.10)]">
        <div
          className={`h-full transition-all ${low ? "bg-red-600" : "bg-[#c8a84b]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] uppercase tracking-widest ${low ? "text-red-500" : "text-[rgba(200,168,75,0.55)]"}`}>
        {remaining} / {total} left today
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Shop() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("materials");
  const [materials, setMaterials] = useState<MaterialShopItem[] | null>(null);
  const [myPurchases, setMyPurchases] = useState<Record<string, number>>({});
  const [robItems, setRobItems] = useState<RobShopItem[] | null>(null);
  const [balances, setBalances] = useState<Pick<DashboardResponse, "ryo" | "kitsu"> | null>(null);
  const [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalState, setModalState] = useState<BuyModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [shopRes, purchasesRes, robRes, dashRes, invRes] = await Promise.all([
        getMaterialShop(),
        getMyMaterialPurchases(),
        getRobItemShop(),
        getDashboard(),
        getInventory(),
      ]);
      setMaterials(shopRes.items);
      setMyPurchases(purchasesRes.purchases);
      setRobItems(robRes.items);
      setBalances({ ryo: dashRes.ryo, kitsu: dashRes.kitsu });
      setOwnedItemIds(new Set(invRes.ownedItemIds));
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setLoadError("Couldn't load the shop. Try refreshing.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const openMaterialModal = (item: MaterialShopItem) => {
    const alreadyBought = myPurchases[item.materialId] ?? 0;
    const remainingCap = item.perPlayerDailyCap - alreadyBought;
    const maxQty = Math.max(1, Math.min(remainingCap, item.remaining));
    if (remainingCap <= 0) return;
    setModalError("");
    setModalState({ kind: "material", item, maxQty });
  };

  const openRobModal = (item: RobShopItem) => {
    if (item.durability === "permanent" && ownedItemIds.has(item.itemId)) return;
    const maxQty = item.durability === "permanent" ? 1 : 99;
    setModalError("");
    setModalState({ kind: "rob-item", item, maxQty });
  };

  const handleConfirm = async (quantity: number, currency: "ryo" | "kitsu") => {
    if (!modalState) return;
    setSubmitting(true);
    setModalError("");
    try {
      if (modalState.kind === "material") {
        const item = modalState.item as MaterialShopItem;
        const res = await buyMaterial({ materialId: item.materialId, quantity, currency });
        setBalances((b) => (b ? { ...b, [currency]: res.newBalance } : b));
        setMyPurchases((p) => ({ ...p, [item.materialId]: (p[item.materialId] ?? 0) + quantity }));
        setMaterials((items) => items?.map((i) =>
          i.materialId === item.materialId ? { ...i, remaining: i.remaining - quantity } : i
        ) ?? null);
        setToast(`+${quantity} ${item.emoji} ${item.name}`);
      } else {
        const item = modalState.item as RobShopItem;
        const res = await buyRobItem({ itemId: item.itemId, quantity });
        setBalances((b) => (b ? { ...b, [res.currency]: res.newBalance } : b));
        if (item.durability === "permanent") setOwnedItemIds((prev) => new Set(prev).add(item.itemId));
        setToast(`+${res.unitsCredited} ${item.emoji} ${item.name}`);
      }
      setModalState(null);
    } catch (err) {
      if (err instanceof ApiResponseError) setModalError(err.error.message ?? "Purchase failed.");
      else setModalError("Purchase failed. Try again.");
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="theme-body text-sm">{loadError}</p>
        <button type="button" onClick={() => window.location.reload()}
          className="h-11 border border-[#c8a84b] px-8 text-sm font-bold uppercase tracking-widest text-[#c8a84b] transition-all hover:bg-[#c8a84b] hover:text-black">
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Brush-stroke header ── */}
        <div className="section-header">
          <span className="section-header-text">Shop</span>
        </div>

        <hr className="gold-rule" />

        {/* ── Tabs ── */}
        <div className="flex gap-0 border-b border-[rgba(200,168,75,0.15)]">
          {[
            { id: "materials" as const,  label: "Materials" },
            { id: "rob-items" as const,  label: "Rob Gear"  },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                tab === t.id
                  ? "text-[#c8a84b]"
                  : "text-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.70)]"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.6)]" />
              )}
            </button>
          ))}
        </div>

        {/* ── Materials tab ── */}
        {tab === "materials" && materials && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map((item) => {
              const bought      = myPurchases[item.materialId] ?? 0;
              const capReached  = bought >= item.perPlayerDailyCap;
              const outOfStock  = item.remaining <= 0;
              const disabled    = capReached || outOfStock;

              return (
                <div
                  key={item.materialId}
                  className={`form-card flex flex-col gap-3 border p-4 transition-opacity ${disabled ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-sm font-bold text-[#c8a84b]">
                      {item.name}
                    </span>
                  </div>

                  <StockBar remaining={item.remaining} total={item.globalDailyStock} />

                  <div className="flex items-center justify-between text-xs text-[rgba(200,168,75,0.50)]">
                    <span>🪙 {formatNumber(item.buyPriceRyo)} · 🦊 {formatNumber(item.buyPriceKitsu)}</span>
                    <span>{bought}/{item.perPlayerDailyCap} bought</span>
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => openMaterialModal(item)}
                    className="mt-1 h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
                  >
                    {capReached ? "Daily Cap Reached" : outOfStock ? "Out of Stock" : "Buy"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Rob items tab ── */}
        {tab === "rob-items" && robItems && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {robItems.map((item) => {
              const alreadyOwned = item.durability === "permanent" && ownedItemIds.has(item.itemId);

              return (
                <div
                  key={item.itemId}
                  className={`form-card flex flex-col gap-3 border p-4 transition-opacity ${alreadyOwned ? "opacity-40" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.emoji}</span>
                      <span className="text-sm font-bold text-[#f0e6c8]">
                        {item.name}
                      </span>
                    </div>
                    <span className="border border-[rgba(200,168,75,0.30)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#c8a84b]">
                      {item.category}
                    </span>
                  </div>

                  <p className="text-xs leading-5 text-[rgba(200,168,75,0.55)]">{item.description}</p>

                  <div className="flex items-center justify-between text-xs text-[rgba(200,168,75,0.45)]">
                    <span className="uppercase tracking-widest">
                      {item.durability === "charges" ? `${item.maxCharges ?? 1} charges` : item.durability}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-[#c8a84b]">
                      {item.currency === "ryo" ? <Coins className="h-3.5 w-3.5" /> : "🦊"}
                      {formatNumber(item.price)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={alreadyOwned}
                    onClick={() => openRobModal(item)}
                    className="mt-1 h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
                  >
                    {alreadyOwned ? "Already Owned" : "Buy"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modalState && (
        <BuyModal
          state={modalState}
          onClose={() => setModalState(null)}
          onConfirm={handleConfirm}
          submitting={submitting}
          error={modalError}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-[#c8a84b] bg-black/95 px-5 py-3 text-sm font-bold text-[#c8a84b] shadow-[0_0_25px_rgba(200,168,75,0.35)] animate-[shop-toast-in_0.3s_ease-out]">
          ✦ {toast}
        </div>
      )}
    </>
  );
}
