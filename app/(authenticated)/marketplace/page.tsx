"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import Image from "next/image";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  X,
  Tag,
  PackageOpen,
  Users,
  History,
  Heart,
  ArrowLeft,
} from "lucide-react";
import {
  getMarketplaceListings,
  getMarketplaceCardDetail,
  buyMarketplaceListing,
  cancelMarketplaceListing,
  listCardOnMarketplace,
  getInventoryCards,
  ApiResponseError,
} from "../../../lib/api";
import type {
  MarketplaceListing,
  MarketplaceSort,
  MarketplaceCardDetail,
  CardInstance,
} from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";
import { CurrencyIcon } from "../../components/CurrencyIcon";

const MAX_TILT_DEG = 8;
const PAGE_SIZE_HINT = 24;

const RARITY_COLORS: Record<string, string> = {
  C: "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.5)]",
  R: "border-[rgba(120,200,150,0.35)] text-[#7fd39c]",
  SR: "border-[rgba(90,160,230,0.4)] text-[#6fb2f0]",
  SSR: "border-[rgba(190,110,230,0.45)] text-[#c98af0]",
  UR: "border-[rgba(230,180,60,0.55)] text-[#f0c445]",
};

// Matches RARITY_COLORS' tiers — a soft glow behind the hero art in the
// card detail panel, stronger for rarer tiers. C gets none; a glow on
// the most common tier would just be visual noise across a full grid.
const RARITY_SHADOWS: Record<string, string> = {
  C: "",
  R: "shadow-[0_0_14px_rgba(120,200,150,0.18)]",
  SR: "shadow-[0_0_16px_rgba(90,160,230,0.2)]",
  SSR: "shadow-[0_0_18px_rgba(190,110,230,0.25)]",
  UR: "shadow-[0_0_22px_rgba(230,180,60,0.35)]",
};

const SORTS: { id: MarketplaceSort; label: string; icon: typeof Clock }[] = [
  { id: "newest", label: "Newest", icon: Clock },
  { id: "price_asc", label: "Price ↑", icon: TrendingUp },
  { id: "price_desc", label: "Price ↓", icon: TrendingDown },
  { id: "rarity", label: "Rarity", icon: Sparkles },
];

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// ── Debounce a fast-changing value (search box, price inputs) ──────
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Listing tile — same pointer-tracked 3D tilt as CardTile, plus a
// price ribbon and buy affordance. Kept local rather than extending
// CardTile itself since a marketplace tile's data shape (seller,
// price, instanceId) is different enough from the catalog browser's
// (shortId, wishlist count) that forcing one prop union through both
// would make CardTile itself harder to read for its original purpose.
function ListingTile({
  listing,
  canAfford,
  index,
  onOpen,
}: {
  listing: MarketplaceListing;
  canAfford: boolean;
  index: number;
  onOpen: (listing: MarketplaceListing) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [active, setActive] = useState(false);

  const updateFromPoint = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * MAX_TILT_DEG * 2;
    const rotateX = (0.5 - py) * MAX_TILT_DEG * 2;
    setStyle({
      transform: `translateY(-4px) scale(1.03) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
      ["--sheen-x" as string]: `${px * 100}%`,
      ["--sheen-y" as string]: `${py * 100}%`,
    });
  }, []);

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" || e.pointerType === "pen") {
      updateFromPoint(e.clientX, e.clientY);
    }
  };
  const handlePointerEnter = (e: PointerEvent<HTMLButtonElement>) => {
    setActive(true);
    if (e.pointerType === "touch") updateFromPoint(e.clientX, e.clientY);
  };
  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    setActive(true);
    updateFromPoint(e.clientX, e.clientY);
  };
  const reset = () => {
    setActive(false);
    setStyle({});
  };

  const card = listing.card;
  const rarityClass = card ? RARITY_COLORS[card.rarity] : RARITY_COLORS.C;
  const isVideo = card?.mediaType === "video";

  return (
    <button
      type="button"
      onClick={() => onOpen(listing)}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={reset}
      onPointerLeave={reset}
      onPointerCancel={reset}
      className="card-tile-wrap block text-left [animation:shop-card-in_0.3s_ease-out_backwards]"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div
        ref={ref}
        className={`card-tile relative overflow-hidden rounded-md bg-black ${active ? "is-active" : ""}`}
        style={style}
      >
        <div className="relative aspect-[3/4] w-full">
          {card ? (
            isVideo ? (
              <video
                src={card.mediaUrl}
                className="h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.mediaUrl}
                alt={card.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[rgba(200,168,75,0.04)] text-[rgba(200,168,75,0.25)]">
              <PackageOpen className="h-8 w-8" />
            </div>
          )}

          <div className="card-tile-sheen absolute inset-0" />

          <span
            className={`absolute left-1.5 top-1.5 rounded-sm border bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${rarityClass}`}
          >
            {card?.rarity ?? "?"}
          </span>
          <span className="absolute right-1.5 top-1.5 rounded-sm bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-[rgba(200,168,75,0.55)]">
            #{listing.issueNumber}
          </span>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2 pb-2 pt-8">
            <p className="truncate font-ui text-xs font-semibold text-[#f0e6c8]">
              {card?.name ?? "Unknown Card"}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#e6c96a]">
              <CurrencyIcon type="kitsu" size={12} />
              {formatNumber(listing.price)}
              {!canAfford && (
                <span className="ml-auto rounded-sm bg-red-500/15 px-1 py-0.5 text-[8px] font-bold uppercase tracking-widest text-red-400">
                  Can&apos;t afford
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Buy confirm / listing detail modal ──────────────────────────────
type BuyPhase = "detail" | "confirm" | "buying" | "success" | "fail";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const METHOD_LABELS: Record<string, string> = {
  market: "Bought on Marketplace",
  trade: "Traded",
  gacha: "Pulled",
  drop: "Won in Minigame",
  admin: "Granted",
  event: "Claimed at Event",
};

function OwnerHistoryRow({
  event,
  index,
}: {
  event: MarketplaceCardDetail["history"][number];
  index: number;
}) {
  return (
    <div
      className="trade-row-in flex items-center gap-2.5 border-b border-[rgba(200,168,75,0.08)] py-2.5 last:border-0"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[rgba(200,168,75,0.1)]">
        {event.ownerAvatarUrl ? (
          <Image
            src={event.ownerAvatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[rgba(200,168,75,0.5)]">
            {event.ownerName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[#f0e6c8]">
          {event.ownerName}
        </p>
        <p className="truncate text-[10px] text-[rgba(200,168,75,0.4)]">
          {METHOD_LABELS[event.method] ?? event.method}
          {event.fromOwnerName ? ` from ${event.fromOwnerName}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {event.price !== null && (
          <p className="flex items-center justify-end gap-1 text-[10px] font-bold text-[#e6c96a]">
            <CurrencyIcon type="kitsu" size={10} />
            {formatNumber(event.price)}
          </p>
        )}
        <p className="text-[9px] text-[rgba(200,168,75,0.35)]">
          {fmtDate(event.acquiredAt)}
        </p>
      </div>
    </div>
  );
}

function BuyModal({
  listing,
  onClose,
  onBought,
}: {
  listing: MarketplaceListing;
  onClose: () => void;
  onBought: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<BuyPhase>("detail");
  const [failMsg, setFailMsg] = useState("");
  const [detail, setDetail] = useState<MarketplaceCardDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const { kitsu, refresh } = useCurrency();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    el.showModal();
    const handler = () => onClose();
    el.addEventListener("cancel", handler);
    return () => el.removeEventListener("cancel", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMarketplaceCardDetail(listing.instanceId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch(() => {
        if (!cancelled)
          setDetailError("Couldn't load this card's history right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [listing.instanceId]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      phase !== "buying" &&
      phase !== "success"
    )
      onClose();
  };

  const handleConfirm = async () => {
    setPhase("buying");
    try {
      await buyMarketplaceListing(listing.instanceId);
      refresh();
      setPhase("success");
      onBought();
    } catch (err) {
      const message =
        err instanceof ApiResponseError
          ? (err.error.message ?? "Purchase failed.")
          : "Purchase failed. Try again.";
      setFailMsg(message);
      setPhase("fail");
    }
  };

  const card = listing.card;
  const rarityClass = card ? RARITY_COLORS[card.rarity] : RARITY_COLORS.C;
  const rarityShadow = card ? RARITY_SHADOWS[card.rarity] : "";
  const canAfford = kitsu === null || kitsu >= listing.price;
  const sellerName =
    detail?.history[detail.history.length - 1]?.ownerName ?? null;
  const visibleHistory = detail?.history.slice().reverse().slice(0, 8) ?? [];

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="craft-modal-pop m-auto max-h-[85vh] w-full max-w-sm flex-col border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex"
      aria-modal="true"
    >
      {phase === "detail" && (
        <>
          <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
              Card Details
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="flex gap-4">
              <div
                className={`h-32 w-24 shrink-0 overflow-hidden rounded-md border bg-black transition-shadow ${rarityClass} ${rarityShadow}`}
              >
                {card && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.mediaUrl}
                    alt={card.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={`inline-block rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${rarityClass}`}
                >
                  {card?.rarity}
                </span>
                <p className="mt-1 text-sm font-semibold leading-tight text-[#f0e6c8]">
                  {card?.name}
                </p>
                <p className="truncate text-xs text-[rgba(200,168,75,0.5)]">
                  {card?.seriesName}
                </p>
                <p className="mt-0.5 text-[10px] text-[rgba(200,168,75,0.35)]">
                  Copy #{listing.issueNumber}
                </p>

                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#e6c96a]">
                  <CurrencyIcon type="kitsu" size={14} />
                  {formatNumber(listing.price)}
                </div>
              </div>
            </div>

            {/* ── Seller ── */}
            <div className="mt-4 flex items-center gap-2.5 rounded-md border border-[rgba(200,168,75,0.12)] bg-[rgba(200,168,75,0.03)] px-3 py-2.5">
              <Tag className="h-3.5 w-3.5 shrink-0 text-[rgba(200,168,75,0.5)]" />
              <p className="min-w-0 truncate text-xs text-[rgba(200,168,75,0.7)]">
                Listed by{" "}
                <span className="font-semibold text-[#f0e6c8]">
                  {sellerName ?? "a player"}
                </span>
              </p>
            </div>

            {/* ── Stats ── */}
            {detail?.card && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  {
                    icon: Users,
                    label: "Owners",
                    value: formatNumber(detail.card.ownerCount),
                  },
                  {
                    icon: Heart,
                    label: "Wishlisted",
                    value: formatNumber(detail.wishlistCount),
                  },
                  {
                    icon: Sparkles,
                    label: "Issued",
                    value: formatNumber(detail.card.totalIssued),
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center gap-1 rounded-md border border-[rgba(200,168,75,0.12)] py-2 text-center"
                  >
                    <s.icon className="h-3.5 w-3.5 text-[rgba(200,168,75,0.45)]" />
                    <span className="text-xs font-bold text-[#e6c96a]">
                      {s.value}
                    </span>
                    <span className="text-[8px] uppercase tracking-widest text-[rgba(200,168,75,0.4)]">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Ownership history ── */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-1.5">
                <History className="h-3 w-3 text-[rgba(200,168,75,0.4)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.5)]">
                  Ownership History
                </span>
              </div>
              {detailError ? (
                <p className="py-4 text-center text-xs text-[rgba(200,168,75,0.4)]">
                  {detailError}
                </p>
              ) : !detail ? (
                <div className="flex justify-center py-6">
                  <svg
                    className="h-5 w-5 animate-spin text-[rgba(200,168,75,0.4)]"
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
              ) : visibleHistory.length === 0 ? (
                <p className="py-4 text-center text-xs text-[rgba(200,168,75,0.4)]">
                  No recorded history for this copy yet.
                </p>
              ) : (
                <div className="rounded-md border border-[rgba(200,168,75,0.1)] px-3">
                  {visibleHistory.map((e, i) => (
                    <OwnerHistoryRow
                      key={`${e.ownerId}-${e.acquiredAt}`}
                      event={e}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[rgba(200,168,75,0.15)] px-5 py-4">
            {!canAfford && (
              <div className="mb-3 border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                You don&apos;t have enough Kitsu for this listing.
              </div>
            )}
            <button
              type="button"
              disabled={!canAfford}
              onClick={() => setPhase("confirm")}
              className="h-11 w-full border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Buy for {formatNumber(listing.price)} Kitsu
            </button>
          </div>
        </>
      )}

      {phase === "confirm" && (
        <>
          <div className="flex items-center gap-2 border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
            <button
              type="button"
              onClick={() => setPhase("detail")}
              aria-label="Back"
              className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
              {card?.name ?? "Card"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-5 py-5">
            <div className="flex items-center gap-4">
              <div
                className={`h-24 w-20 shrink-0 overflow-hidden rounded-md border bg-black ${rarityClass}`}
              >
                {card && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.mediaUrl}
                    alt={card.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <span
                  className={`inline-block rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${rarityClass}`}
                >
                  {card?.rarity}
                </span>
                <p className="mt-1 truncate text-sm font-semibold text-[#f0e6c8]">
                  {card?.name}
                </p>
                <p className="truncate text-xs text-[rgba(200,168,75,0.5)]">
                  {card?.seriesName}
                </p>
                <p className="mt-0.5 text-[10px] text-[rgba(200,168,75,0.35)]">
                  Copy #{listing.issueNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[rgba(200,168,75,0.12)] pt-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                Price
              </span>
              <span className="flex items-center gap-1.5 text-lg font-bold text-[#e6c96a]">
                <CurrencyIcon type="kitsu" size={18} />
                {formatNumber(listing.price)}
              </span>
            </div>

            {!canAfford && (
              <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                You don&apos;t have enough Kitsu for this listing.
              </div>
            )}

            <button
              type="button"
              disabled={!canAfford}
              onClick={handleConfirm}
              className="h-11 w-full border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Confirm Purchase
            </button>
          </div>
        </>
      )}

      {phase === "buying" && (
        <div className="flex flex-col items-center gap-4 px-8 py-14">
          <svg
            className="h-8 w-8 animate-spin text-[#c8a84b]"
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
          <p className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.5)]">
            Confirming trade…
          </p>
        </div>
      )}

      {phase === "success" && (
        <div className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="reveal-pop relative flex h-28 w-28 items-center justify-center">
            <div className="reveal-glow-pulse absolute inset-0 rounded-full bg-[#c8a84b]/20 blur-xl" />
            <div
              className={`relative h-24 w-20 overflow-hidden rounded-md border bg-black ${rarityClass}`}
            >
              {card && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.mediaUrl}
                  alt={card.name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <span
              className="ember-particle absolute bottom-0 left-2 h-1.5 w-1.5 rounded-full bg-[#e6c96a]"
              style={{ animationDelay: "0s" }}
            />
            <span
              className="ember-particle absolute bottom-0 right-2 h-1.5 w-1.5 rounded-full bg-[#e6c96a]"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-wide text-[#e6c96a]">
              Card Acquired
            </p>
            <p className="mt-1 text-sm text-[#f0e6c8]">{card?.name}</p>
            <p className="text-xs text-[rgba(200,168,75,0.45)]">
              now in your collection
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
          <button type="button" onClick={onClose} className="brush-btn w-40">
            Close
          </button>
        </div>
      )}
    </dialog>
  );
}

// ── Sell modal — pick an unlisted card, set a price ──────────────────
function SellModal({
  onClose,
  onListed,
}: {
  onClose: () => void;
  onListed: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [cards, setCards] = useState<CardInstance[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [selected, setSelected] = useState<CardInstance | null>(null);
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [listed, setListed] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    el.showModal();
    const handler = () => onClose();
    el.addEventListener("cancel", handler);
    return () => el.removeEventListener("cancel", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getInventoryCards({ listed: "false", sort: "newest" })
      .then((res) => setCards(res.items.filter((c) => !c.isLocked)))
      .catch(() => setError("Couldn't load your cards."))
      .finally(() => setLoadingCards(false));
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current && !submitting) onClose();
  };

  const handleList = async () => {
    if (!selected) return;
    const priceNum = parseInt(price, 10);
    if (!Number.isInteger(priceNum) || priceNum < 1) {
      setError("Enter a valid price of at least 1 Kitsu.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await listCardOnMarketplace(selected.instanceId, priceNum);
      setListed(true);
      onListed();
    } catch (err) {
      setError(
        err instanceof ApiResponseError
          ? (err.error.message ?? "Couldn't list this card.")
          : "Couldn't list this card.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="craft-modal-pop m-auto w-full max-w-md border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col"
      aria-modal="true"
    >
      <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
          {listed ? "Listed" : selected ? "Set a Price" : "Choose a Card"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {listed ? (
        <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
          <div className="reveal-pop flex h-16 w-16 items-center justify-center rounded-full border border-[#c8a84b]/40 bg-[#c8a84b]/10">
            <Tag className="h-7 w-7 text-[#c8a84b]" />
          </div>
          <p className="font-display text-base font-bold text-[#e6c96a]">
            Card Listed
          </p>
          <p className="text-xs text-[rgba(200,168,75,0.5)]">
            {selected?.card?.name} is now live on the marketplace.
          </p>
          <button type="button" onClick={onClose} className="brush-btn w-40">
            Done
          </button>
        </div>
      ) : !selected ? (
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-5 py-5">
          {loadingCards ? (
            <p className="py-8 text-center text-xs text-[rgba(200,168,75,0.4)]">
              Loading your cards…
            </p>
          ) : cards.length === 0 ? (
            <p className="py-8 text-center text-xs text-[rgba(200,168,75,0.4)]">
              You don&apos;t have any unlisted cards to sell.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {cards.map((c) => (
                <button
                  key={c.instanceId}
                  type="button"
                  onClick={() => setSelected(c)}
                  className="overflow-hidden rounded-md border border-[rgba(200,168,75,0.15)] text-left transition-colors hover:border-[#c8a84b]"
                >
                  <div className="relative aspect-[3/4] w-full bg-black">
                    {c.card && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.card.mediaUrl}
                        alt={c.card.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span
                      className={`absolute left-1 top-1 rounded-sm border bg-black/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-widest ${c.card ? RARITY_COLORS[c.card.rarity] : ""}`}
                    >
                      {c.card?.rarity}
                    </span>
                  </div>
                  <p className="truncate px-1 py-1 text-[9px] text-[#f0e6c8]">
                    {c.card?.name ?? "Unknown"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="h-24 w-20 shrink-0 overflow-hidden rounded-md border border-[rgba(200,168,75,0.2)] bg-black">
              {selected.card && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.card.mediaUrl}
                  alt={selected.card.name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#f0e6c8]">
                {selected.card?.name}
              </p>
              <p className="truncate text-xs text-[rgba(200,168,75,0.5)]">
                {selected.card?.seriesName}
              </p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.45)] underline underline-offset-2 hover:text-[#c8a84b]"
              >
                Choose a different card
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
              Listing Price (Kitsu)
            </span>
            <div className="flex items-center gap-2 border border-[rgba(200,168,75,0.25)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
              <CurrencyIcon type="kitsu" size={16} />
              <input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 500"
                className="w-full bg-transparent text-sm text-[#f0e6c8] outline-none"
              />
            </div>
          </label>

          {error && (
            <p className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={submitting || !price}
            onClick={handleList}
            className="h-11 w-full border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Listing…" : "List for Sale"}
          </button>
        </div>
      )}
    </dialog>
  );
}

// ── My Listings tab ───────────────────────────────────────────────
function MyListings({
  listings,
  loading,
  onCancelled,
}: {
  listings: MarketplaceListing[];
  loading: boolean;
  onCancelled: (instanceId: string) => void;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (instanceId: string) => {
    setCancellingId(instanceId);
    try {
      await cancelMarketplaceListing(instanceId);
      onCancelled(instanceId);
    } catch {
      // leave it in the list — the user can retry
    } finally {
      setCancellingId(null);
    }
  };

  if (loading)
    return (
      <p className="py-12 text-center text-xs text-[rgba(200,168,75,0.4)]">
        Loading your listings…
      </p>
    );

  if (listings.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <Tag className="h-5 w-5 text-[rgba(200,168,75,0.25)]" />
        <p className="text-sm text-[rgba(200,168,75,0.40)]">
          You don&apos;t have any active listings.
        </p>
      </div>
    );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <div
          key={listing.instanceId}
          className="form-card overflow-hidden border"
        >
          <div className="relative aspect-[3/4] w-full bg-black">
            {listing.card && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.card.mediaUrl}
                alt={listing.card.name}
                className="h-full w-full object-cover"
              />
            )}
            <span
              className={`absolute left-1.5 top-1.5 rounded-sm border bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${listing.card ? RARITY_COLORS[listing.card.rarity] : ""}`}
            >
              {listing.card?.rarity}
            </span>
          </div>
          <div className="flex flex-col gap-2 p-2.5">
            <p className="truncate text-xs font-semibold text-[#f0e6c8]">
              {listing.card?.name ?? "Unknown"}
            </p>
            <p className="flex items-center gap-1 text-xs font-bold text-[#e6c96a]">
              <CurrencyIcon type="kitsu" size={12} />
              {formatNumber(listing.price)}
            </p>
            <button
              type="button"
              disabled={cancellingId === listing.instanceId}
              onClick={() => handleCancel(listing.instanceId)}
              className="h-8 border border-[rgba(200,168,75,0.25)] text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)] transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
            >
              {cancellingId === listing.instanceId
                ? "Cancelling…"
                : "Cancel Listing"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
type Tab = "browse" | "mine";

export default function Marketplace() {
  const router = useRouter();
  const { kitsu } = useCurrency();
  const [tab, setTab] = useState<Tab>("browse");

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<MarketplaceSort>("newest");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [myListingsPage, setMyListingsPage] = useState(1);
  const [myListingsTotalPages, setMyListingsTotalPages] = useState(1);

  const [activeListing, setActiveListing] = useState<MarketplaceListing | null>(
    null,
  );
  const [sellOpen, setSellOpen] = useState(false);

  const loadBrowse = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await getMarketplaceListings({
        page,
        sort,
        q: debouncedSearch || undefined,
      });
      setListings(res.listings);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setLoadError("Couldn't load the marketplace. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, debouncedSearch, router]);

  useEffect(() => {
    loadBrowse();
  }, [loadBrowse]);

  // reset to page 1 whenever the filters change underneath the user
  useEffect(() => {
    setPage(1);
  }, [sort, debouncedSearch]);

  const loadMyListings = useCallback(async () => {
    setMyListingsLoading(true);
    try {
      // FIX: this previously fetched the global unfiltered browse feed
      // (page 1, no seller filter) and tried to narrow it down to
      // "listings I know I created this session" by intersecting
      // against its own prior in-memory state — which is empty on
      // first load, so myListings was permanently stuck empty no
      // matter what was actually listed. GET /marketplace?mine=true
      // already exists server-side (marketplace.ts filters
      // instanceFilter.ownerId to the authed player) — this just
      // wasn't being used. Also now paginated instead of hardcoded to
      // page 1, since a seller can have more than one page of listings.
      const res = await getMarketplaceListings({
        page: myListingsPage,
        mine: true,
      });
      setMyListings(res.listings);
      setMyListingsTotalPages(res.totalPages);
    } catch {
      setMyListings([]);
    } finally {
      setMyListingsLoading(false);
    }
  }, [myListingsPage]);

  useEffect(() => {
    if (tab === "mine") loadMyListings();
  }, [tab, loadMyListings]);

  const handleCancelled = (instanceId: string) => {
    // Optimistic — remove immediately rather than waiting on a refetch.
    setMyListings((prev) => prev.filter((l) => l.instanceId !== instanceId));
  };

  const handleListed = () => {
    // Now that My Listings has a real mine=true fetch, refresh both
    // feeds for real instead of the old "hope it's on page 1 of
    // browse" guess.
    loadBrowse();
    if (tab === "mine") loadMyListings();
  };

  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="section-header">
          <span className="section-header-text">Marketplace</span>
        </div>

        <hr className="gold-rule" />

        {/* ── Tabs + Sell button ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {[
              { id: "browse" as const, label: "Browse" },
              { id: "mine" as const, label: "My Listings" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                  tab === t.id
                    ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b]"
                    : "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.5)] hover:border-[rgba(200,168,75,0.35)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSellOpen(true)}
            className="flex items-center gap-1.5 border border-[#c8a84b] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black"
          >
            <Tag className="h-3.5 w-3.5" />
            Sell
          </button>
        </div>

        {tab === "browse" && (
          <>
            {/* ── Search + sort ── */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(200,168,75,0.4)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by card name…"
                  className="form-input h-10 w-full border pl-9 pr-3 text-sm outline-none"
                />
              </div>
              <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSort(s.id)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      sort === s.id
                        ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b]"
                        : "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.5)] hover:border-[rgba(200,168,75,0.35)]"
                    }`}
                  >
                    <s.icon className="h-3 w-3" />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {total > 0 && !loading && (
              <p className="text-xs text-[rgba(200,168,75,0.4)]">
                {formatNumber(total)} listing{total !== 1 ? "s" : ""}
              </p>
            )}

            {loading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
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
            ) : loadError ? (
              <div className="flex flex-col items-center gap-4 py-14 text-center">
                <p className="text-sm text-[rgba(200,168,75,0.5)]">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => loadBrowse()}
                  className="h-10 border border-[#c8a84b] px-6 text-xs font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black"
                >
                  Retry
                </button>
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <PackageOpen className="h-5 w-5 text-[rgba(200,168,75,0.25)]" />
                <p className="text-sm text-[rgba(200,168,75,0.40)]">
                  {debouncedSearch
                    ? `No listings match "${debouncedSearch}".`
                    : "No active listings right now."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {listings.map((listing, i) => (
                    <ListingTile
                      key={listing.instanceId}
                      listing={listing}
                      index={i}
                      canAfford={kitsu === null || kitsu >= listing.price}
                      onOpen={setActiveListing}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-9 border border-[rgba(200,168,75,0.25)] px-4 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-[rgba(200,168,75,0.5)]">
                      Page {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="h-9 border border-[rgba(200,168,75,0.25)] px-4 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "mine" && (
          <>
            <MyListings
              listings={myListings}
              loading={myListingsLoading}
              onCancelled={handleCancelled}
            />
            {myListingsTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={myListingsPage <= 1}
                  onClick={() => setMyListingsPage((p) => Math.max(1, p - 1))}
                  className="h-9 border border-[rgba(200,168,75,0.25)] px-4 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Prev
                </button>
                <span className="text-xs text-[rgba(200,168,75,0.5)]">
                  Page {myListingsPage} / {myListingsTotalPages}
                </span>
                <button
                  type="button"
                  disabled={myListingsPage >= myListingsTotalPages}
                  onClick={() =>
                    setMyListingsPage((p) =>
                      Math.min(myListingsTotalPages, p + 1),
                    )
                  }
                  className="h-9 border border-[rgba(200,168,75,0.25)] px-4 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {activeListing && (
        <BuyModal
          listing={activeListing}
          onClose={() => setActiveListing(null)}
          onBought={() => {
            setListings((prev) =>
              prev.filter((l) => l.instanceId !== activeListing.instanceId),
            );
          }}
        />
      )}

      {sellOpen && (
        <SellModal onClose={() => setSellOpen(false)} onListed={handleListed} />
      )}
    </>
  );
}
