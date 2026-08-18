"use client";

import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent
} from "react";
import {
    Clock,
    TrendingUp,
    TrendingDown,
    Sparkles,
    Gavel,
    PackageOpen,
    Users,
    Zap,
    Plus,
    X,
    Loader2
} from "lucide-react";
import {
    getAuctions,
    getInventoryCards,
    listCardForAuction,
    getAuctionTerms,
    ApiResponseError,
    type AuctionListing,
    type AuctionSort,
    type CardInstance,
    type AuctionTermsResponse,
    type CatalogCardRarity
} from "../../../lib/api";
import { useCurrency } from "../../components/CurrencyContext";
import { CurrencyIcon } from "../../components/CurrencyIcon";

const MAX_TILT_DEG = 8;

const RARITY_COLORS: Record<string, string> = {
    C: "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.5)]",
    R: "border-[rgba(120,200,150,0.35)] text-[#7fd39c]",
    SR: "border-[rgba(90,160,230,0.4)] text-[#6fb2f0]",
    SSR: "border-[rgba(190,110,230,0.45)] text-[#c98af0]",
    UR: "border-[rgba(230,180,60,0.55)] text-[#f0c445]"
};

const RARITIES = ["C", "R", "SR", "SSR", "UR"] as const;

const SORTS: { id: AuctionSort; label: string; icon: typeof Clock }[] = [
    { id: "ending_soon", label: "Ending Soon", icon: Clock },
    { id: "newest", label: "Newest", icon: Sparkles },
    { id: "price_asc", label: "Price ↑", icon: TrendingUp },
    { id: "price_desc", label: "Price ↓", icon: TrendingDown }
];

function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
}

// ── Live countdown — mm:ss under an hour, else Xh Ym, else Xd Yh.
// Ticks every second locally rather than refetching; "urgent" (under
// 5 minutes) drives the red pulse class from globals.css.
function useCountdown(expiresAt: string): {
    label: string;
    urgent: boolean;
    done: boolean;
} {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    const remainingMs = new Date(expiresAt).getTime() - now;
    if (remainingMs <= 0) return { label: "Ended", urgent: false, done: true };

    const totalSec = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    let label: string;
    if (days > 0) label = `${days}d ${hours}h`;
    else if (hours > 0) label = `${hours}h ${minutes}m`;
    else label = `${minutes}:${String(seconds).padStart(2, "0")}`;

    return { label, urgent: remainingMs < 5 * 60_000, done: false };
}

function CountdownChip({ expiresAt }: { expiresAt: string }) {
    const { label, urgent, done } = useCountdown(expiresAt);
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-sm border bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                done
                    ? "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.35)]"
                    : urgent
                      ? "auction-countdown-urgent border-red-500/40 text-red-300"
                      : "border-[rgba(200,168,75,0.25)] text-[#e6c96a]"
            }`}
        >
            <Clock className="h-2.5 w-2.5" />
            {label}
        </span>
    );
}

// ── Auction tile — same pointer-tracked 3D tilt as the marketplace's
// ListingTile, plus a countdown chip and bid-count badge instead of a
// flat price ribbon, since an auction's "current bid" is live state,
// not a fixed price.
function AuctionTile({
    listing,
    canAfford,
    index,
    onOpen
}: {
    listing: AuctionListing;
    canAfford: boolean;
    index: number;
    onOpen: (listing: AuctionListing) => void;
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
            ["--sheen-y" as string]: `${py * 100}%`
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
            className="card-tile-wrap auction-tile-in block text-left"
            style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
        >
            <div
                ref={ref}
                className={`card-tile relative overflow-hidden ${active ? "is-active" : ""}`}
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
                    <div className="absolute right-1.5 top-1.5">
                        <CountdownChip expiresAt={listing.expiresAt} />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2 pb-2 pt-8">
                        <p className="truncate font-ui text-xs font-semibold text-[#f0e6c8]">
                            {card?.name ?? "Unknown Card"}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-1">
                            <p className="flex items-center gap-1 text-xs font-bold text-[#e6c96a]">
                                <CurrencyIcon type="kitsu" size={12} />
                                {formatNumber(listing.currentBid)}
                                {!canAfford && (
                                    <span className="ml-1 rounded-sm bg-red-500/15 px-1 py-0.5 text-[8px] font-bold uppercase tracking-widest text-red-400">
                                        Can&apos;t afford
                                    </span>
                                )}
                            </p>
                            {listing.bidCount > 0 && (
                                <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-semibold text-[rgba(200,168,75,0.55)]">
                                    <Users className="h-2.5 w-2.5" />
                                    {listing.bidCount}
                                </span>
                            )}
                        </div>
                        {listing.buyNowPrice !== null && (
                            <p className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-[#f0c445]">
                                <Zap className="h-2.5 w-2.5" />
                                Buy Now {formatNumber(listing.buyNowPrice)}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}

// ── List-a-card modal ────────────────────────────────────────────────
//
// Two steps in one dialog: pick an owned card, then optionally set a
// Buy Now price. Starting bid and auction duration are entirely
// server-derived (rarity-based increment/duration, see
// computeAuctionStartingBid in core/auctions.ts) — this form only ever
// collects instanceId + optional buyNowPrice, matching listCardForAuction's
// actual signature exactly rather than inventing extra fields the
// backend doesn't accept.
//
// Eligibility: isLocked, listing, pendingTradeId, and activeLoanId are
// all exposed by GET /inventory/cards and checked here — an ineligible
// card is grayed out, unclickable, and shows why (badge + title
// tooltip). The one thing still NOT checkable client-side is the
// level-3 requirement (AUCTION_MIN_LEVEL in core/auctions.ts) — that's
// a player-level property, not a per-card one, so a sub-level-3 player
// can still pick a perfectly eligible card and only find out on submit.
// Same "server is the actual gate" fallback for that one case.
function ListCardModal({
    open,
    onClose,
    onListed
}: {
    open: boolean;
    onClose: () => void;
    onListed: () => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [cards, setCards] = useState<CardInstance[]>([]);
    const [cardsLoading, setCardsLoading] = useState(true);
    const [cardsError, setCardsError] = useState("");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");

    const [selected, setSelected] = useState<CardInstance | null>(null);
    const [buyNowPrice, setBuyNowPrice] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [terms, setTerms] = useState<AuctionTermsResponse | null>(null);
    // durationHours starts at null until terms load, then snaps to that
    // card's rarity default — set in the effect below once both `terms`
    // and `selected` are known, not here (rarity isn't picked yet).
    const [durationHours, setDurationHours] = useState<number | null>(null);

    useEffect(() => {
        const el = dialogRef.current;
        if (!el) return;
        if (open && !el.open) el.showModal();
        else if (!open && el.open) el.close();
    }, [open]);

    // Reset all form state each time the modal is (re)opened, so a
    // previous card/price/error doesn't linger into the next open.
    useEffect(() => {
        if (!open) return;
        setSelected(null);
        setBuyNowPrice("");
        setSubmitError("");
        setSearch("");
        setSearchInput("");
        setDurationHours(null);
    }, [open]);

    // Fetch the fee/duration terms once per modal open — cheap, cached
    // by nothing (deliberately: these numbers can be retuned server-side
    // and this modal should always reflect the current values, not a
    // stale build-time copy).
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        getAuctionTerms()
            .then(res => {
                if (!cancelled) setTerms(res);
            })
            .catch(() => {
                // Non-fatal — the duration control just won't render without
                // terms loaded; buy-now-only listing at rarity default still
                // works fine via the backend's own default when durationHours
                // is omitted.
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    // Snap the duration slider to the selected card's rarity default the
    // moment both the card and terms are known — covers picking a card
    // before terms finish loading, and switching between cards of
    // different rarities mid-session.
    useEffect(() => {
        if (!selected?.card || !terms) return;
        const rarity = selected.card.rarity as CatalogCardRarity;
        setDurationHours(terms.terms[rarity].durationMs / 3_600_000);
    }, [selected, terms]);

    // Debounce search — /inventory/cards is a real paginated backend
    // query (not a client-side filter over an already-fetched page), so
    // firing it on every keystroke would be wasteful. 350ms matches the
    // profile page's cards-section search debounce.
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setCardsLoading(true);
        setCardsError("");
        // listed: "false" — a card already listed for sale/auction is
        // ineligible for a NEW auction listing anyway (listCardForAuction
        // rejects "already_listed"), so there's no reason to show it in a
        // picker whose entire purpose is starting a fresh listing.
        getInventoryCards({ q: search || undefined, listed: "false" })
            .then(res => {
                if (cancelled) return;
                setCards(res.items);
            })
            .catch(() => {
                if (cancelled) return;
                setCardsError("Couldn't load your cards. Try again.");
            })
            .finally(() => {
                if (!cancelled) setCardsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, search]);

    const parsedBuyNow =
        buyNowPrice.trim() === "" ? null : Math.floor(Number(buyNowPrice));
    const buyNowInvalid =
        buyNowPrice.trim() !== "" &&
        (!Number.isFinite(parsedBuyNow) || (parsedBuyNow ?? 0) < 1);

    // Live fee preview — mirrors core/auctions.ts's computeDurationSurcharge
    // exactly (same quadratic curve, same 20x ceiling multiplier) so the
    // number shown here matches what actually gets charged on submit.
    // Recomputing client-side just avoids a network round-trip per slider
    // tick; the backend remains the sole source of truth for the real
    // charge regardless of what this shows.
    const rarity = selected?.card?.rarity as CatalogCardRarity | undefined;
    const rarityTerm = rarity && terms ? terms.terms[rarity] : null;
    const durationMs =
        durationHours !== null ? durationHours * 3_600_000 : null;
    const durationSurcharge =
        rarity && terms && rarityTerm && durationMs !== null
            ? (() => {
                  const extraMs = durationMs - rarityTerm.durationMs;
                  if (extraMs <= 0) return 0;
                  const maxExtraMs =
                      terms.maxDurationMs - rarityTerm.durationMs;
                  if (maxExtraMs <= 0) return 0;
                  const fraction = Math.min(extraMs / maxExtraMs, 1);
                  return Math.round(
                      terms.baseListingFee[rarity] * 20 * fraction ** 2
                  );
              })()
            : 0;
    const totalFee =
        rarity && terms
            ? terms.baseListingFee[rarity] + durationSurcharge
            : null;

    const handleSubmit = async () => {
        if (!selected || buyNowInvalid) return;
        setSubmitting(true);
        setSubmitError("");
        try {
            await listCardForAuction(
                selected.instanceId,
                parsedBuyNow,
                durationHours ?? undefined
            );
            onListed();
        } catch (err) {
            if (err instanceof ApiResponseError) {
                setSubmitError(err.message || "Couldn't list that card.");
            } else {
                setSubmitError("Something went wrong — try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="w-full max-w-2xl border border-[rgba(200,168,75,0.25)] bg-[#0a0906] p-0 text-[#f0e6c8] backdrop:bg-black"
        >
            <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
                <h2 className="font-ui text-sm font-bold uppercase tracking-widest text-[#c8a84b]">
                    List a Card
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[rgba(200,168,75,0.5)] hover:text-[#c8a84b]"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-4">
                {!selected ? (
                    <>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            placeholder="Search your cards..."
                            className="h-10 border border-[rgba(200,168,75,0.2)] bg-black/40 px-3 text-sm text-[#f0e6c8] placeholder:text-[rgba(200,168,75,0.3)] focus:border-[#c8a84b] focus:outline-none"
                        />

                        {cardsLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-5 w-5 animate-spin text-[#c8a84b]" />
                            </div>
                        ) : cardsError ? (
                            <p className="py-6 text-center text-xs text-[rgba(200,168,75,0.5)]">
                                {cardsError}
                            </p>
                        ) : cards.length === 0 ? (
                            <p className="py-6 text-center text-xs text-[rgba(200,168,75,0.4)]">
                                No cards match — try a different search.
                            </p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {cards.map(c => {
                                    // Full client-side eligibility check now that
                                    // /inventory/cards exposes all three flags — level-3
                                    // requirement is still server-only (not a per-card
                                    // property, so it doesn't belong in this per-card
                                    // check; the whole modal would need gating for that,
                                    // not individual tiles).
                                    const disabled = Boolean(
                                        c.isLocked ||
                                        c.pendingTradeId ||
                                        c.activeLoanId
                                    );
                                    const disabledReason = c.isLocked
                                        ? "Locked — unlock it first"
                                        : c.pendingTradeId
                                          ? "Offered in an active trade"
                                          : c.activeLoanId
                                            ? "Lent out or held as loan collateral"
                                            : undefined;
                                    return (
                                        <button
                                            key={c.instanceId}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() =>
                                                !disabled && setSelected(c)
                                            }
                                            title={disabledReason}
                                            className={`group relative overflow-hidden rounded-sm border text-left transition-colors ${
                                                disabled
                                                    ? "cursor-not-allowed border-[rgba(200,168,75,0.08)] bg-black/60 opacity-40"
                                                    : "border-[rgba(200,168,75,0.15)] bg-black hover:border-[#c8a84b]"
                                            }`}
                                        >
                                            <div className="relative aspect-[3/4] w-full">
                                                {c.card ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={c.card.mediaUrl}
                                                        alt={c.card.name}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center bg-[rgba(200,168,75,0.04)] text-[rgba(200,168,75,0.25)]">
                                                        <PackageOpen className="h-6 w-6" />
                                                    </div>
                                                )}
                                                <span
                                                    className={`absolute left-1 top-1 rounded-sm border bg-black/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-widest ${c.card ? (RARITY_COLORS[c.card.rarity] ?? RARITY_COLORS.C) : RARITY_COLORS.C}`}
                                                >
                                                    {c.card?.rarity ?? "?"}
                                                </span>
                                                {disabled && (
                                                    <span className="absolute right-1 top-1 rounded-sm border border-red-500/40 bg-black/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-widest text-red-300">
                                                        {c.isLocked
                                                            ? "Locked"
                                                            : c.pendingTradeId
                                                              ? "In Trade"
                                                              : "On Loan"}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="truncate px-1 py-1 text-[10px] font-semibold text-[#f0e6c8]">
                                                {c.card?.name ?? "Unknown Card"}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => setSelected(null)}
                            className="self-start text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.5)] hover:text-[#c8a84b]"
                        >
                            ← Choose a different card
                        </button>

                        <div className="flex gap-4">
                            <div className="w-28 shrink-0 overflow-hidden rounded-sm border border-[rgba(200,168,75,0.2)]">
                                {selected.card ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={selected.card.mediaUrl}
                                        alt={selected.card.name}
                                        className="aspect-[3/4] w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex aspect-[3/4] w-full items-center justify-center bg-[rgba(200,168,75,0.04)] text-[rgba(200,168,75,0.25)]">
                                        <PackageOpen className="h-6 w-6" />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-1">
                                <span
                                    className={`w-fit rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${selected.card ? (RARITY_COLORS[selected.card.rarity] ?? RARITY_COLORS.C) : RARITY_COLORS.C}`}
                                >
                                    {selected.card?.rarity ?? "?"}
                                </span>
                                <p className="font-ui text-sm font-semibold text-[#f0e6c8]">
                                    {selected.card?.name ?? "Unknown Card"}
                                </p>
                                <p className="text-xs text-[rgba(200,168,75,0.5)]">
                                    {selected.card?.seriesName ?? ""}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                                Buy Now Price (optional)
                            </label>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={buyNowPrice}
                                onChange={e => setBuyNowPrice(e.target.value)}
                                placeholder="Leave blank for bid-only"
                                className="h-10 border border-[rgba(200,168,75,0.2)] bg-black/40 px-3 text-sm text-[#f0e6c8] placeholder:text-[rgba(200,168,75,0.3)] focus:border-[#c8a84b] focus:outline-none"
                            />
                            {buyNowInvalid && (
                                <p className="text-[10px] text-red-400">
                                    Must be a whole number, 1 Kitsu or more.
                                </p>
                            )}
                            <p className="text-[10px] text-[rgba(200,168,75,0.4)]">
                                Starting bid and bid increment are set
                                automatically based on this card&apos;s rarity,
                                and don&apos;t depend on this price.
                            </p>
                        </div>

                        {rarityTerm && terms && durationHours !== null && (
                            <div className="flex flex-col gap-1.5">
                                <label className="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                                    <span>Duration</span>
                                    <span className="text-[#c8a84b]">
                                        {durationHours}h
                                        {durationHours ===
                                        terms.maxDurationMs / 3_600_000
                                            ? " (max)"
                                            : ""}
                                    </span>
                                </label>
                                <input
                                    type="range"
                                    min={rarityTerm.durationMs / 3_600_000}
                                    max={terms.maxDurationMs / 3_600_000}
                                    step={1}
                                    value={durationHours}
                                    onChange={e =>
                                        setDurationHours(Number(e.target.value))
                                    }
                                    className="accent-[#c8a84b]"
                                />
                                <p className="text-[10px] text-[rgba(200,168,75,0.4)]">
                                    {rarityTerm.durationMs / 3_600_000}h is
                                    included in the base listing fee. Extending
                                    toward the {terms.maxDurationMs / 3_600_000}
                                    h max costs more — up to{" "}
                                    {formatNumber(
                                        terms.maxDurationFee[rarity!]
                                    )}{" "}
                                    Kitsu total for this rarity at max duration.
                                </p>
                            </div>
                        )}

                        {totalFee !== null && (
                            <div className="flex items-center justify-between border border-[rgba(200,168,75,0.15)] bg-[rgba(200,168,75,0.04)] px-3 py-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                                    Listing Fee
                                </span>
                                <span className="flex items-center gap-1 text-sm font-semibold text-[#f0e6c8]">
                                    <CurrencyIcon type="kitsu" size={14} />
                                    {formatNumber(totalFee)}
                                    {durationSurcharge > 0 && (
                                        <span className="text-[10px] font-normal text-[rgba(200,168,75,0.5)]">
                                            (
                                            {formatNumber(
                                                terms!.baseListingFee[rarity!]
                                            )}{" "}
                                            base +{" "}
                                            {formatNumber(durationSurcharge)}{" "}
                                            for duration)
                                        </span>
                                    )}
                                </span>
                            </div>
                        )}

                        {submitError && (
                            <p className="text-xs text-red-400">
                                {submitError}
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || buyNowInvalid}
                            className="mt-1 flex h-11 items-center justify-center gap-2 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Gavel className="h-4 w-4" />
                            )}
                            List Auction
                        </button>
                    </>
                )}
            </div>
        </dialog>
    );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Auctions() {
    const router = useRouter();
    const { kitsu } = useCurrency();

    const [listings, setListings] = useState<AuctionListing[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [sort, setSort] = useState<AuctionSort>("ending_soon");
    const [rarityFilter, setRarityFilter] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [listModalOpen, setListModalOpen] = useState(false);

    const toggleRarity = (r: string) => {
        setRarityFilter(prev => {
            const next = new Set(prev);
            if (next.has(r)) next.delete(r);
            else next.add(r);
            return next;
        });
        setPage(1);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError("");
        try {
            const res = await getAuctions({
                page,
                sort,
                rarity: rarityFilter.size
                    ? [...rarityFilter].join(",")
                    : undefined
            });
            setListings(res.items);
            setTotalPages(res.totalPages);
            setTotal(res.total);
        } catch (err) {
            if (err instanceof ApiResponseError && err.status === 401) {
                router.push("/login");
                return;
            }
            setLoadError("Couldn't load auctions. Try refreshing.");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sort, rarityFilter, router]);

    useEffect(() => {
        load();
    }, [load]);

    // Auctions expire in real time — a listing that hits :00 shouldn't
    // sit in the grid looking biddable, so we quietly re-sync with the
    // server periodically rather than trusting the client clock alone
    // to know when something's actually gone.
    useEffect(() => {
        const t = setInterval(load, 30_000);
        return () => clearInterval(t);
    }, [load]);

    return (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="section-header">
                <span className="section-header-text">Auction House</span>
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setListModalOpen(true)}
                    className="flex items-center gap-1.5 border border-[#c8a84b] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black"
                >
                    <Plus className="h-3 w-3" />
                    List a Card
                </button>
            </div>

            <ListCardModal
                open={listModalOpen}
                onClose={() => setListModalOpen(false)}
                onListed={() => {
                    setListModalOpen(false);
                    setPage(1);
                    load();
                }}
            />

            <hr className="gold-rule" />

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
                    {SORTS.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                                setSort(s.id);
                                setPage(1);
                            }}
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

                <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
                    {RARITIES.map(r => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => toggleRarity(r)}
                            className={`shrink-0 whitespace-nowrap rounded-sm border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                                rarityFilter.has(r)
                                    ? `${RARITY_COLORS[r]} bg-[rgba(200,168,75,0.1)]`
                                    : "border-[rgba(200,168,75,0.12)] text-[rgba(200,168,75,0.35)] hover:border-[rgba(200,168,75,0.3)]"
                            }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {total > 0 && !loading && (
                <p className="text-xs text-[rgba(200,168,75,0.4)]">
                    {formatNumber(total)} active auction{total !== 1 ? "s" : ""}
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
                        onClick={() => load()}
                        className="h-10 border border-[#c8a84b] px-6 text-xs font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black"
                    >
                        Retry
                    </button>
                </div>
            ) : listings.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                    <Gavel className="h-5 w-5 text-[rgba(200,168,75,0.25)]" />
                    <p className="text-sm text-[rgba(200,168,75,0.40)]">
                        No active auctions right now.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                        {listings.map((listing, i) => (
                            <AuctionTile
                                key={listing.instanceId}
                                listing={listing}
                                index={i}
                                canAfford={
                                    kitsu === null ||
                                    kitsu >= listing.currentBid
                                }
                                onOpen={l =>
                                    router.push(`/auctions/${l.instanceId}`)
                                }
                            />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
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
                                    setPage(p => Math.min(totalPages, p + 1))
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
    );
}
