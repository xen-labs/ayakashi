"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { X, Lock, Check, Sparkles } from "lucide-react";
import {
  getShopListings,
  buyItem,
  getInventory,
  ApiResponseError,
} from "../../../lib/api";
import type { ShopListing, ShopSection } from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";
import { CurrencyIcon } from "../../components/CurrencyIcon";

// Images come straight from item.webappImage (populated by
// itemRegistry.ts via shopCatalog.ts) — no local override map needed
// anymore now that every item has a registry-backed path.

// ── Tabs — every section the backend actually serves ────────────────
const TABS: { id: ShopSection; label: string; icon: string }[] = [
  { id: "items", label: "Items", icon: "🎒" },
  { id: "rob_gear", label: "Rob Gear", icon: "🗡️" },
  { id: "defence_gear", label: "Defence", icon: "🛡️" },
  { id: "cosmetics", label: "Cosmetics", icon: "🖼️" },
  { id: "hunting", label: "Hunting", icon: "🔫" },
  { id: "farming", label: "Farming", icon: "🌾" },
  { id: "cooking", label: "Cooking", icon: "🍲" },
];

// ── One-of-a-kind permanent items ──────────────────────────────────
const ONE_OF_A_KIND = new Set([
  "crafting_table",
  "home_vault",
  "debit_card",
  "gear_hunting_rifle",
  "gear_hoe",
  "gear_cooking_pot",
]);

// ── Rarity theming — border/glow/text tint per rarity tier ─────────
const RARITY_STYLES: Record<
  string,
  { border: string; glow: string; text: string; label: string }
> = {
  common: {
    border: "border-[rgba(200,168,75,0.15)]",
    glow: "",
    text: "text-[rgba(200,168,75,0.45)]",
    label: "Common",
  },
  uncommon: {
    border: "border-[rgba(120,200,150,0.35)]",
    glow: "shadow-[0_0_16px_rgba(120,200,150,0.12)]",
    text: "text-[#7fd39c]",
    label: "Uncommon",
  },
  rare: {
    border: "border-[rgba(90,160,230,0.4)]",
    glow: "shadow-[0_0_18px_rgba(90,160,230,0.15)]",
    text: "text-[#6fb2f0]",
    label: "Rare",
  },
  epic: {
    border: "border-[rgba(190,110,230,0.45)]",
    glow: "shadow-[0_0_20px_rgba(190,110,230,0.18)]",
    text: "text-[#c98af0]",
    label: "Epic",
  },
  legendary: {
    border: "border-[rgba(230,180,60,0.55)]",
    glow: "shadow-[0_0_24px_rgba(230,180,60,0.22)]",
    text: "text-[#f0c445]",
    label: "Legendary",
  },
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// Fixed 8-point radial burst for the confirm-button coin spark — computed
// once, not per-render, since the directions never change.
const SPARK_OFFSETS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  const dist = 26;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
});

function rarityStyleColor(rarity?: string): string {
  switch (rarity) {
    case "uncommon":
      return "rgba(120,200,150,0.25)";
    case "rare":
      return "rgba(90,160,230,0.28)";
    case "epic":
      return "rgba(190,110,230,0.3)";
    case "legendary":
      return "rgba(230,180,60,0.32)";
    default:
      return "transparent";
  }
}

// ── Item image block — the dominant visual on the card, not a strip ──
// Previously fixed at compact:56px / full:80px regardless of card
// size — on a 2-up mobile grid (~160px card width) that's under 35%
// of the card's width with a near-empty band above it. Now the image
// container itself IS most of the card (aspect-square, art scaled to
// fill it), matching how the art-forward reference the team liked
// leads with large illustration rather than a small icon.
//
// `frame`, not `compact`, now controls sizing — this is used in two
// very different contexts: full grid cards (frame="card", wants to
// dominate the card) and a small fixed-size modal thumbnail
// (frame="thumb", wants to fit a 64px box without its own border
// cutting across it, since that border was designed for a full-width
// strip).
function ItemImage({
  item,
  frame,
}: {
  item: ShopListing;
  frame: "card" | "thumb";
}) {
  const [broken, setBroken] = useState(false);
  const src = item.webappImage || undefined;
  const rarityStyle = item.rarity ? RARITY_STYLES[item.rarity] : null;
  const isThumb = frame === "thumb";

  return (
    <div
      className={`relative flex ${isThumb ? "h-full w-full" : "aspect-square w-full border-b border-[rgba(200,168,75,0.12)]"} items-center justify-center overflow-hidden bg-[rgba(200,168,75,0.04)]`}
    >
      {/* subtle rarity backdrop glow */}
      {rarityStyle && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40 [animation:shop-glow-pulse_3.2s_ease-in-out_infinite]"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${rarityStyleColor(item.rarity)}, transparent 70%)`,
          }}
        />
      )}
      {src && !broken ? (
        <Image
          src={src}
          alt={item.name}
          width={isThumb ? 64 : 200}
          height={isThumb ? 64 : 200}
          onError={() => setBroken(true)}
          className={`relative ${isThumb ? "h-11 w-11" : "h-[86%] w-[86%]"} object-contain drop-shadow-[0_4px_16px_rgba(200,168,75,0.35)] transition-transform duration-300 group-hover:scale-[1.08]`}
          unoptimized
        />
      ) : (
        <span
          className={`relative ${isThumb ? "text-3xl" : "text-7xl"} leading-none select-none transition-transform duration-300 group-hover:scale-110`}
          role="img"
          aria-label={item.name}
        >
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

type BuyPhase = "form" | "success" | "fail";

function BuyModal({
  state,
  onClose,
  onConfirm,
  submitting,
}: {
  state: BuyModalState;
  onClose: () => void;
  onConfirm: (
    quantity: number,
    currency: "ryo" | "kitsu",
  ) => Promise<{ ok: true; quantity: number } | { ok: false; message: string }>;
  submitting: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [qty, setQty] = useState(1);
  const [currency, setCurrency] = useState<"ryo" | "kitsu">(
    state.item.currency,
  );
  const [phase, setPhase] = useState<BuyPhase>("form");
  const [boughtQty, setBoughtQty] = useState(0);
  const [failMsg, setFailMsg] = useState("");
  const rarityStyle = state.item.rarity
    ? RARITY_STYLES[state.item.rarity]
    : null;

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
    if (e.target === dialogRef.current && phase !== "form") onClose();
  };

  const KITSU_TO_RYO = 100;
  const canConvert = !state.item.noConversion;
  const unitPrice =
    currency === state.item.currency
      ? state.item.price
      : currency === "kitsu"
        ? Math.ceil(state.item.price / KITSU_TO_RYO)
        : state.item.price * KITSU_TO_RYO;

  const total = unitPrice * qty;

  const [bursting, setBursting] = useState(false);

  const handleConfirmClick = async () => {
    setBursting(true);
    const res = await onConfirm(qty, currency);
    if (res.ok) {
      setBoughtQty(res.quantity);
      setPhase("success");
    } else {
      setFailMsg(res.message);
      setPhase("fail");
    }
    setBursting(false);
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="craft-modal-pop m-auto w-full max-w-sm border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col"
      aria-modal="true"
    >
      {phase === "form" && (
        <>
          <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
                {state.item.name}
              </h2>
              {rarityStyle && (
                <span
                  className={`text-[9px] font-bold uppercase tracking-widest ${rarityStyle.text}`}
                >
                  {rarityStyle.label}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-5 py-5">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-[rgba(200,168,75,0.04)] ${rarityStyle ? rarityStyle.border : "border-[rgba(200,168,75,0.15)]"}`}
              >
                <ItemImage item={state.item} frame="thumb" />
              </div>
              {state.item.flavor && (
                <p className="text-xs italic leading-5 text-[rgba(200,168,75,0.50)]">
                  {state.item.flavor}
                </p>
              )}
            </div>

            {state.item.itemId !== "lottery_ticket" && canConvert && (
              <div className="flex gap-2">
                {(["ryo", "kitsu"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                      currency === c
                        ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b]"
                        : "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.45)] hover:border-[rgba(200,168,75,0.35)]"
                    }`}
                  >
                    <CurrencyIcon type={c} size={14} />
                    {c === "ryo" ? "Ryo" : "Kitsu"}
                  </button>
                ))}
              </div>
            )}

            {!canConvert && (
              <div className="flex items-center gap-2 border border-[rgba(200,168,75,0.15)] bg-[rgba(200,168,75,0.04)] px-3 py-2 text-[11px] text-[rgba(200,168,75,0.5)]">
                <CurrencyIcon type={state.item.currency} size={13} />
                <span>
                  This item can only be purchased with{" "}
                  {state.item.currency === "kitsu" ? "Kitsu" : "Ryo"}.
                </span>
              </div>
            )}

            {state.maxQty > 1 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                  Quantity
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="h-8 w-8 border border-[rgba(200,168,75,0.25)] text-[#f0e6c8] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b]"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={qty}
                    min={1}
                    max={state.maxQty}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v))
                        setQty(Math.min(state.maxQty, Math.max(1, v)));
                    }}
                    className="form-input h-8 w-16 border text-center outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(state.maxQty, q + 1))}
                    className="h-8 w-8 border border-[rgba(200,168,75,0.25)] text-[#f0e6c8] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b]"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[rgba(200,168,75,0.12)] pt-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                Total
              </span>
              <span
                key={total}
                className="flex items-center gap-1.5 text-lg font-bold text-[#e6c96a] [animation:number-tick_0.2s_ease-out]"
              >
                <CurrencyIcon type={currency} size={18} /> {formatNumber(total)}
              </span>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmClick}
              className="relative h-11 w-full overflow-hidden border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Purchasing…" : "Confirm Purchase"}
              {bursting && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {SPARK_OFFSETS.map((offset, i) => (
                    <span
                      key={i}
                      className="coin-spark absolute h-1 w-1 rounded-full bg-black/70"
                      style={
                        {
                          "--burst-x": `${offset.x}px`,
                          "--burst-y": `${offset.y}px`,
                          animationDelay: `${i * 15}ms`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </span>
              )}
            </button>
          </div>
        </>
      )}

      {phase === "success" && (
        <div className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="reveal-pop relative flex h-28 w-28 items-center justify-center">
            <div className="reveal-glow-pulse absolute inset-0 rounded-full bg-[#c8a84b]/20 blur-xl" />
            <div
              className={`relative flex h-24 w-24 items-center justify-center rounded-full border bg-black/40 ${rarityStyle ? rarityStyle.border : "border-[rgba(200,168,75,0.25)]"}`}
            >
              <ItemImage item={state.item} frame="thumb" />
            </div>
            {/* coin particles — reuses craft's ember-particle keyframe */}
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
              Purchase Complete
            </p>
            <p className="number-tick mt-1 flex items-center justify-center gap-1.5 text-sm text-[#f0e6c8]">
              +{boughtQty}× {state.item.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="brush-btn w-40">
            Nice
          </button>
        </div>
      )}

      {phase === "fail" && (
        <div className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="shake-fail flex h-28 w-28 items-center justify-center rounded-full border border-red-500/30 bg-red-500/5">
            <X className="h-12 w-12 text-red-400/80" />
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-wide text-red-400">
              Purchase Failed
            </p>
            <p className="mt-1 text-xs text-[rgba(200,168,75,0.45)]">
              {failMsg}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPhase("form")}
              className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.7)] hover:border-[#c8a84b] hover:text-[#c8a84b]"
            >
              Try Again
            </button>
            <button type="button" onClick={onClose} className="brush-btn w-32">
              Close
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

// ── Durability badge ───────────────────────────────────────────────
function DurabilityBadge({ item }: { item: ShopListing }) {
  if (!item.durability) return null;
  const labels: Record<string, string> = {
    permanent: "Permanent",
    "single-use": "Single Use",
    "shatter-on-fail": "Shatters",
    charges: item.maxCharges ? `${item.maxCharges}x` : "Charges",
  };
  return (
    <span className="border border-[rgba(200,168,75,0.25)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
      {labels[item.durability] ?? item.durability}
    </span>
  );
}

// ── Item card ───────────────────────────────────────────────────────
function ItemCard({
  item,
  index,
  locked,
  alreadyOwned,
  onBuy,
}: {
  item: ShopListing;
  index: number;
  locked: boolean;
  alreadyOwned: boolean;
  onBuy: (item: ShopListing) => void;
}) {
  const rarityStyle = item.rarity ? RARITY_STYLES[item.rarity] : null;
  const disabled = alreadyOwned || locked;

  return (
    <div
      className={`form-card group relative flex flex-col overflow-hidden border transition-all [animation:shop-card-in_0.3s_ease-out_backwards] ${
        rarityStyle ? rarityStyle.border : "border-[rgba(200,168,75,0.12)]"
      } ${rarityStyle?.glow ?? ""} ${
        disabled
          ? "opacity-50"
          : "hover:-translate-y-0.5 hover:border-[rgba(200,168,75,0.5)] hover:shadow-[0_4px_20px_rgba(200,168,75,0.1)] active:scale-[0.97] active:transition-transform active:duration-75"
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      {/* shimmer sweep on hover for legendary/epic items */}
      {!disabled && (item.rarity === "legendary" || item.rarity === "epic") && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="absolute inset-y-0 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:[animation:shop-shimmer-sweep_1s_ease-in-out]" />
        </div>
      )}

      <ItemImage item={item} frame="card" />

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-1.5">
          <span className="font-display text-xs font-bold leading-tight text-[#f0e6c8]">
            {item.name}
          </span>
          {item.robCategory && (
            <span className="shrink-0 border border-[rgba(200,168,75,0.30)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#c8a84b]">
              {item.robCategory}
            </span>
          )}
        </div>

        {rarityStyle && item.rarity !== "common" && (
          <span
            className={`text-[9px] font-bold uppercase tracking-widest ${rarityStyle.text}`}
          >
            {rarityStyle.label}
          </span>
        )}

        {item.flavor && (
          <p className="line-clamp-2 text-[10px] italic leading-4 text-[rgba(200,168,75,0.45)]">
            {item.flavor}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5">
          <DurabilityBadge item={item} />
          <span className="flex items-center gap-1 text-xs font-bold text-[#e6c96a]">
            <CurrencyIcon type={item.currency} size={12} />
            {formatNumber(item.price)}
            {item.priceIsPlaceholder && (
              <span className="ml-0.5 text-[9px] text-[rgba(200,168,75,0.35)]">
                est.
              </span>
            )}
          </span>
        </div>

        {locked && item.minLevel !== undefined ? (
          <button
            type="button"
            disabled
            className="flex h-8 items-center justify-center gap-1.5 border border-[rgba(200,168,75,0.20)] text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.35)]"
          >
            <Lock className="h-3 w-3" />
            Requires Lv. {item.minLevel}
          </button>
        ) : (
          <button
            type="button"
            disabled={alreadyOwned}
            onClick={() => onBuy(item)}
            className="flex h-8 items-center justify-center gap-1.5 border border-[#c8a84b] text-[10px] font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
          >
            {alreadyOwned ? (
              <>
                <Check className="h-3 w-3" /> Owned
              </>
            ) : (
              "Buy"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Shop() {
  const router = useRouter();
  const { refresh: refreshCurrency } = useCurrency();
  const [tab, setTab] = useState<ShopSection>("items");
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set());
  // Player level isn't returned by /shop or /inventory today — level
  // gating still works because the backend enforces it on purchase and
  // returns a level_too_low error either way. If you later expose the
  // player's level from an existing call (e.g. /profile), wire it here
  // to grey out gated items up front instead of only on attempted buy.
  const [playerLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalState, setModalState] = useState<BuyModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [shopRes, invRes] = await Promise.all([
        getShopListings(),
        getInventory(),
      ]);
      setListings(shopRes.listings);
      setOwnedItemIds(new Set(invRes.ownedItemIds));
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setLoadError("Couldn't load the shop. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Counts per tab, so the tab bar can show how many items live there —
  // helps orient on a small screen before you even tap in.
  const countsBySection = useMemo(() => {
    const counts: Partial<Record<ShopSection, number>> = {};
    for (const l of listings) counts[l.section] = (counts[l.section] ?? 0) + 1;
    return counts;
  }, [listings]);

  const visibleListings = listings.filter((l) => l.section === tab);

  const isLocked = (item: ShopListing) =>
    item.minLevel !== undefined &&
    playerLevel !== null &&
    playerLevel < item.minLevel;

  const openModal = (item: ShopListing) => {
    const isOneOfAKind =
      ONE_OF_A_KIND.has(item.itemId) || item.durability === "permanent";
    if (isOneOfAKind && ownedItemIds.has(item.itemId)) return;
    if (isLocked(item)) return;
    const maxQty = isOneOfAKind ? 1 : 99;
    setModalState({ item, maxQty });
  };

  const handleConfirm = async (
    quantity: number,
    currency: "ryo" | "kitsu",
  ): Promise<
    { ok: true; quantity: number } | { ok: false; message: string }
  > => {
    if (!modalState) return { ok: false, message: "Something went wrong." };
    setSubmitting(true);
    try {
      const res = await buyItem({
        itemId: modalState.item.itemId,
        currency,
        quantity,
      });
      if (
        ONE_OF_A_KIND.has(modalState.item.itemId) ||
        modalState.item.durability === "permanent"
      ) {
        setOwnedItemIds((prev) => new Set(prev).add(modalState.item.itemId));
      }
      refreshCurrency();
      return { ok: true, quantity: res.quantity };
    } catch (err) {
      const message =
        err instanceof ApiResponseError
          ? (err.error.message ?? "Purchase failed.")
          : "Purchase failed. Try again.";
      return { ok: false, message };
    } finally {
      setSubmitting(false);
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

  if (loadError)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="theme-body text-sm">{loadError}</p>
        <button
          type="button"
          onClick={() => loadAll()}
          className="h-11 border border-[#c8a84b] px-8 text-sm font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black"
        >
          Retry
        </button>
      </div>
    );

  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="section-header">
          <span className="section-header-text">Shop</span>
        </div>

        <hr className="gold-rule" />

        {/* ── Tabs — horizontally scrollable on mobile ── */}
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {TABS.map((t) => {
            const count = countsBySection[t.id] ?? 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap border px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-all ${
                  tab === t.id
                    ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b] shadow-[0_0_10px_rgba(200,168,75,0.15)]"
                    : "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.5)] hover:border-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.8)]"
                }`}
              >
                <span aria-hidden="true">{t.icon}</span>
                {t.label}
                {count > 0 && (
                  <span
                    className={`text-[9px] ${tab === t.id ? "text-[rgba(200,168,75,0.7)]" : "text-[rgba(200,168,75,0.3)]"}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Item grid — 2-up on mobile, scales up on larger screens ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {visibleListings.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-14 text-center">
              <Sparkles className="h-5 w-5 text-[rgba(200,168,75,0.25)]" />
              <p className="text-sm text-[rgba(200,168,75,0.40)]">
                Nothing here yet.
              </p>
            </div>
          )}
          {visibleListings.map((item, i) => {
            const isOneOfAKind =
              ONE_OF_A_KIND.has(item.itemId) || item.durability === "permanent";
            const alreadyOwned = isOneOfAKind && ownedItemIds.has(item.itemId);
            return (
              <ItemCard
                key={item.itemId}
                item={item}
                index={i}
                locked={isLocked(item)}
                alreadyOwned={alreadyOwned}
                onBuy={openModal}
              />
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
        />
      )}
    </>
  );
}
