"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import {
  getShopListings,
  buyItem,
  getInventory,
  ApiResponseError,
} from "../../../lib/api";
import type { ShopListing, ShopSection } from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";

// ── Local image map — itemId → public path ─────────────────────────
// We only have loot-material images locally. Everything else falls
// back to a large emoji rendered in the image slot.
const LOCAL_ITEM_IMAGES: Record<string, string> = {
  mat_abyssal_pearl:     "/loot-materials/loot-materials/abyssal-pearl.webp",
  mat_ancient_relic:     "/loot-materials/loot-materials/ancient-relic.webp",
  mat_astral_magatama:   "/loot-materials/loot-materials/astral-magatama.webp",
  mat_cursed_fox_skull:  "/loot-materials/loot-materials/cursed-skull.webp",
  mat_sea_dragon_scale:  "/loot-materials/loot-materials/dragon-scale.webp",
  mat_prize_fish:        "/loot-materials/loot-materials/gather_fish_big_catch.webp",
  mat_kitsu_core:        "/loot-materials/loot-materials/kitsu-core.webp",
  mat_starborn_meteorite:"/loot-materials/loot-materials/meteorite.webp",
  mat_mystic_crystal:    "/loot-materials/loot-materials/mystic-crystal.webp",
  item_soul_ticket:      "/loot-materials/loot-materials/soul-ticket.webp",
};

// ── Tabs ───────────────────────────────────────────────────────────
const TABS: { id: ShopSection; label: string }[] = [
  { id: "items",        label: "Items"        },
  { id: "rob_gear",     label: "Rob Gear"     },
  { id: "defence_gear", label: "Defence Gear" },
];

// ── One-of-a-kind permanent items ──────────────────────────────────
const ONE_OF_A_KIND = new Set(["crafting_table", "home_vault", "debit_card"]);

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// ── Item image block — big, fills top of card ─────────────────────
function ItemImage({ item }: { item: ShopListing }) {
  const localSrc = LOCAL_ITEM_IMAGES[item.itemId];
  return (
    <div className="flex h-28 w-full items-center justify-center overflow-hidden border-b border-[rgba(200,168,75,0.12)] bg-[rgba(200,168,75,0.04)]">
      {localSrc ? (
        <Image
          src={localSrc}
          alt={item.name}
          width={96}
          height={96}
          className="h-20 w-20 object-contain drop-shadow-[0_0_12px_rgba(200,168,75,0.3)]"
          unoptimized
        />
      ) : (
        <span className="text-6xl leading-none select-none" role="img" aria-label={item.name}>
          {item.emoji}
        </span>
      )}
    </div>
  );
}

// ── Buy Modal ──────────────────────────────────────────────────────
interface BuyModalState {
  item: ShopListing;
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
  const [currency, setCurrency] = useState<"ryo" | "kitsu">(state.item.currency);

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

  const KITSU_TO_RYO = 100;
  const unitPrice =
    currency === state.item.currency
      ? state.item.price
      : currency === "kitsu"
      ? Math.ceil(state.item.price / KITSU_TO_RYO)
      : state.item.price * KITSU_TO_RYO;

  const total = unitPrice * qty;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="m-auto w-full max-w-sm border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col"
      aria-modal="true"
    >
      <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
          {state.item.name}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close"
          className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        {state.item.flavor && (
          <p className="text-xs italic leading-5 text-[rgba(200,168,75,0.50)]">{state.item.flavor}</p>
        )}

        {state.item.itemId !== "lottery_ticket" && (
          <div className="flex gap-2">
            {(["ryo", "kitsu"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCurrency(c)}
                className={`flex-1 border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  currency === c
                    ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b]"
                    : "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.45)] hover:border-[rgba(200,168,75,0.35)]"
                }`}>
                {c === "ryo" ? "🪙 Ryo" : "🦊 Kitsu"}
              </button>
            ))}
          </div>
        )}

        {state.maxQty > 1 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">Quantity</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-8 w-8 border border-[rgba(200,168,75,0.25)] text-[#f0e6c8] hover:border-[#c8a84b] hover:text-[#c8a84b]">−</button>
              <input type="number" value={qty} min={1} max={state.maxQty}
                onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setQty(Math.min(state.maxQty, Math.max(1, v))); }}
                className="form-input h-8 w-16 border text-center outline-none" />
              <button type="button" onClick={() => setQty((q) => Math.min(state.maxQty, q + 1))}
                className="h-8 w-8 border border-[rgba(200,168,75,0.25)] text-[#f0e6c8] hover:border-[#c8a84b] hover:text-[#c8a84b]">+</button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[rgba(200,168,75,0.12)] pt-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">Total</span>
          <span className="text-lg font-bold text-[#e6c96a]">
            {currency === "ryo" ? "🪙" : "🦊"} {formatNumber(total)}
          </span>
        </div>

        {error && (
          <p className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
        )}

        <button type="button" disabled={submitting} onClick={() => onConfirm(qty, currency)}
          className="h-11 w-full border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Purchasing…" : "Confirm Purchase"}
        </button>
      </div>
    </dialog>
  );
}

// ── Durability badge ───────────────────────────────────────────────
function DurabilityBadge({ item }: { item: ShopListing }) {
  if (!item.durability) return null;
  const labels: Record<string, string> = {
    permanent:        "Permanent",
    "single-use":     "Single Use",
    "shatter-on-fail":"Shatters on Fail",
    charges: item.maxCharges ? `${item.maxCharges} Charges` : "Charges",
  };
  return (
    <span className="border border-[rgba(200,168,75,0.25)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
      {labels[item.durability] ?? item.durability}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Shop() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();
  const [tab, setTab] = useState<ShopSection>("items");
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalState, setModalState] = useState<BuyModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const [shopRes, invRes] = await Promise.all([
        getShopListings(),
        getInventory(),
      ]);
      setListings(shopRes.listings);
      setOwnedItemIds(new Set(invRes.ownedItemIds));
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setLoadError("Couldn't load the shop. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const visibleListings = listings.filter((l) => l.section === tab);

  const openModal = (item: ShopListing) => {
    const isOneOfAKind = ONE_OF_A_KIND.has(item.itemId) || item.durability === "permanent";
    if (isOneOfAKind && ownedItemIds.has(item.itemId)) return;
    const maxQty = isOneOfAKind ? 1 : 99;
    setModalError("");
    setModalState({ item, maxQty });
  };

  const handleConfirm = async (quantity: number, currency: "ryo" | "kitsu") => {
    if (!modalState) return;
    setSubmitting(true); setModalError("");
    try {
      const res = await buyItem({ itemId: modalState.item.itemId, currency, quantity });
      if (ONE_OF_A_KIND.has(modalState.item.itemId) || modalState.item.durability === "permanent") {
        setOwnedItemIds((prev) => new Set(prev).add(modalState.item.itemId));
      }
      refreshCurrency();
      setToast(`+${res.quantity} ${modalState.item.name}`);
      setModalState(null);
    } catch (err) {
      if (err instanceof ApiResponseError) setModalError(err.error.message ?? "Purchase failed.");
      else setModalError("Purchase failed. Try again.");
    } finally {
      setSubmitting(false);
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

  if (loadError) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="theme-body text-sm">{loadError}</p>
      <button type="button" onClick={() => window.location.reload()}
        className="h-11 border border-[#c8a84b] px-8 text-sm font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black">
        Retry
      </button>
    </div>
  );

  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

        <div className="section-header">
          <span className="section-header-text">Shop</span>
        </div>

        <hr className="gold-rule" />

        {/* ── Tabs ── */}
        <div className="flex gap-0 border-b border-[rgba(200,168,75,0.15)]">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`relative px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                tab === t.id ? "text-[#c8a84b]" : "text-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.70)]"
              }`}>
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.6)]" />
              )}
            </button>
          ))}
        </div>

        {/* ── Item grid ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleListings.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
              Nothing here yet.
            </p>
          )}
          {visibleListings.map((item) => {
            const isOneOfAKind = ONE_OF_A_KIND.has(item.itemId) || item.durability === "permanent";
            const alreadyOwned = isOneOfAKind && ownedItemIds.has(item.itemId);

            return (
              <div key={item.itemId}
                className={`form-card flex flex-col overflow-hidden border transition-all hover:border-[rgba(200,168,75,0.45)] ${alreadyOwned ? "opacity-40" : ""}`}>

                {/* ── Big image / emoji at top ── */}
                <ItemImage item={item} />

                {/* ── Card body ── */}
                <div className="flex flex-1 flex-col gap-3 p-4">
                  {/* name + category tag */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-sm font-bold leading-tight text-[#f0e6c8]">
                      {item.name}
                    </span>
                    {item.robCategory && (
                      <span className="shrink-0 border border-[rgba(200,168,75,0.30)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#c8a84b]">
                        {item.robCategory}
                      </span>
                    )}
                  </div>

                  {/* flavor */}
                  {item.flavor && (
                    <p className="text-[11px] italic leading-5 text-[rgba(200,168,75,0.45)] line-clamp-3">
                      {item.flavor}
                    </p>
                  )}

                  {/* durability + price */}
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <DurabilityBadge item={item} />
                    <span className="text-sm font-bold text-[#e6c96a]">
                      {item.currency === "ryo" ? "🪙" : "🦊"} {formatNumber(item.price)}
                      {item.priceIsPlaceholder && (
                        <span className="ml-1 text-[10px] text-[rgba(200,168,75,0.35)]">est.</span>
                      )}
                    </span>
                  </div>

                  <button type="button" disabled={alreadyOwned} onClick={() => openModal(item)}
                    className="h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent">
                    {alreadyOwned ? "Already Owned" : "Buy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {modalState && (
        <BuyModal state={modalState} onClose={() => setModalState(null)}
          onConfirm={handleConfirm} submitting={submitting} error={modalError} />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 border border-[#c8a84b] bg-black/95 px-5 py-3 text-sm font-bold text-[#c8a84b] shadow-[0_0_25px_rgba(200,168,75,0.35)] animate-[shop-toast-in_0.3s_ease-out] lg:bottom-6">
          ✦ {toast}
        </div>
      )}
    </>
  );
}


import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { X } from "lucide-react";
import {
  getShopListings,
  buyItem,
  getInventory,
  getDashboard,
  ApiResponseError,
} from "../../../lib/api";
import type { ShopListing, ShopSection } from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";

// ── Tabs ───────────────────────────────────────────────────────────
const TABS: { id: ShopSection; label: string }[] = [
  { id: "items",        label: "Items"        },
  { id: "rob_gear",     label: "Rob Gear"     },
  { id: "defence_gear", label: "Defence Gear" },
];

// ── One-of-a-kind permanent items ──────────────────────────────────
const ONE_OF_A_KIND = new Set(["crafting_table", "home_vault", "debit_card"]);

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// ── Buy Modal ──────────────────────────────────────────────────────
interface BuyModalState {
  item: ShopListing;
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
  // Default currency is the listing's listed currency
  const [currency, setCurrency] = useState<"ryo" | "kitsu">(state.item.currency);

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

  // Kitsu-to-ryo rate mirrors backend: 100 ryo = 1 kitsu
  const KITSU_TO_RYO = 100;
  const unitPrice =
    currency === state.item.currency
      ? state.item.price
      : currency === "kitsu"
      ? Math.ceil(state.item.price / KITSU_TO_RYO)
      : state.item.price * KITSU_TO_RYO;

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
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
          {state.item.emoji} {state.item.name}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close"
          className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        {/* flavor text */}
        {state.item.flavor && (
          <p className="text-xs italic leading-5 text-[rgba(200,168,75,0.50)]">{state.item.flavor}</p>
        )}

        {/* currency toggle — show both if item isn't a gambling item */}
        {state.item.itemId !== "lottery_ticket" && (
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

        {/* qty — only if not one-of-a-kind */}
        {state.maxQty > 1 && (
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
        )}

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

// ── Durability badge ───────────────────────────────────────────────
function DurabilityBadge({ item }: { item: ShopListing }) {
  if (!item.durability) return null;
  const labels: Record<string, string> = {
    permanent: "Permanent",
    "single-use": "Single Use",
    "shatter-on-fail": "Shatters on Fail",
    charges: item.maxCharges ? `${item.maxCharges} Charges` : "Charges",
  };
  return (
    <span className="border border-[rgba(200,168,75,0.25)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
      {labels[item.durability] ?? item.durability}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Shop() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();
  const [tab, setTab] = useState<ShopSection>("items");
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalState, setModalState] = useState<BuyModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Load all listings + owned item ids once
  const loadAll = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const [shopRes, invRes] = await Promise.all([
        getShopListings(),
        getInventory(),
      ]);
      setListings(shopRes.listings);
      setOwnedItemIds(new Set(invRes.ownedItemIds));
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setLoadError("Couldn't load the shop. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const visibleListings = listings.filter((l) => l.section === tab);

  const openModal = (item: ShopListing) => {
    const isOneOfAKind = ONE_OF_A_KIND.has(item.itemId) || item.durability === "permanent";
    if (isOneOfAKind && ownedItemIds.has(item.itemId)) return;
    const maxQty = isOneOfAKind ? 1 : 99;
    setModalError("");
    setModalState({ item, maxQty });
  };

  const handleConfirm = async (quantity: number, currency: "ryo" | "kitsu") => {
    if (!modalState) return;
    setSubmitting(true); setModalError("");
    try {
      const res = await buyItem({ itemId: modalState.item.itemId, currency, quantity });
      // Mark permanent/one-of-a-kind as owned locally
      if (ONE_OF_A_KIND.has(modalState.item.itemId) || modalState.item.durability === "permanent") {
        setOwnedItemIds((prev) => new Set(prev).add(modalState.item.itemId));
      }
      // Refresh topbar coin balances
      refreshCurrency();
      setToast(`+${res.quantity} ${modalState.item.emoji} ${modalState.item.name}`);
      setModalState(null);
    } catch (err) {
      if (err instanceof ApiResponseError) setModalError(err.error.message ?? "Purchase failed.");
      else setModalError("Purchase failed. Try again.");
    } finally {
      setSubmitting(false);
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

  if (loadError) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="theme-body text-sm">{loadError}</p>
      <button type="button" onClick={() => window.location.reload()}
        className="h-11 border border-[#c8a84b] px-8 text-sm font-bold uppercase tracking-widest text-[#c8a84b] transition-all hover:bg-[#c8a84b] hover:text-black">
        Retry
      </button>
    </div>
  );

  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

        <div className="section-header">
          <span className="section-header-text">Shop</span>
        </div>

        <hr className="gold-rule" />

        {/* ── Tabs ── */}
        <div className="flex gap-0 border-b border-[rgba(200,168,75,0.15)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
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

        {/* ── Item grid ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleListings.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
              Nothing here yet.
            </p>
          )}
          {visibleListings.map((item) => {
            const isOneOfAKind = ONE_OF_A_KIND.has(item.itemId) || item.durability === "permanent";
            const alreadyOwned = isOneOfAKind && ownedItemIds.has(item.itemId);

            return (
              <div
                key={item.itemId}
                className={`form-card flex flex-col gap-3 border p-4 transition-all hover:border-[rgba(200,168,75,0.45)] ${alreadyOwned ? "opacity-40" : ""}`}
              >
                {/* header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{item.emoji}</span>
                    <span className="font-display text-sm font-bold text-[#f0e6c8] leading-tight">{item.name}</span>
                  </div>
                  {item.robCategory && (
                    <span className="shrink-0 border border-[rgba(200,168,75,0.30)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#c8a84b]">
                      {item.robCategory}
                    </span>
                  )}
                </div>

                {/* flavor */}
                {item.flavor && (
                  <p className="text-[11px] italic leading-5 text-[rgba(200,168,75,0.45)] line-clamp-3">{item.flavor}</p>
                )}

                {/* durability + price row */}
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <DurabilityBadge item={item} />
                  <span className="text-sm font-bold text-[#e6c96a]">
                    {item.currency === "ryo" ? "🪙" : "🦊"} {formatNumber(item.price)}
                    {item.priceIsPlaceholder && <span className="ml-1 text-[10px] text-[rgba(200,168,75,0.35)]">est.</span>}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={alreadyOwned}
                  onClick={() => openModal(item)}
                  className="mt-1 h-9 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
                >
                  {alreadyOwned ? "Already Owned" : "Buy"}
                </button>
              </div>
            );
          })}
        </div>
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
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 border border-[#c8a84b] bg-black/95 px-5 py-3 text-sm font-bold text-[#c8a84b] shadow-[0_0_25px_rgba(200,168,75,0.35)] animate-[shop-toast-in_0.3s_ease-out] lg:bottom-6">
          ✦ {toast}
        </div>
      )}
    </>
  );
}
