"use client";

// app/marketplace/[instanceId]/page.tsx
//
// Dedicated detail+buy page for a single marketplace listing —
// previously this was only a modal (BuyModal in marketplace_page.tsx)
// opened from the grid, with no shareable URL and no back-button
// support. This is a real route: /marketplace/[instanceId].
//
// Data comes ENTIRELY from GET /marketplace/card/:instanceId
// (getMarketplaceCardDetail) — unlike the old modal, this page has no
// `listing` prop to seed from (a shared link lands here directly, with
// nothing already fetched), so every field the page needs — price,
// card, issueNumber — comes from the detail response, not a
// grid-passed summary object.
//
// Card media renders with NO forced background/aspect-box (no
// bg-black, no aspect-[3/4] crop container) — cards ship with their
// own alpha-channel edges, and boxing them in a black rectangle just
// shows that transparency as a visible black matte. The image/video
// element sizes to its own natural aspect ratio inside a max-height
// constraint instead.
//
// New: a price history graph (PriceSnapshot data, wired up in this
// pass — previously existed in the schema but nothing read it). Only
// rendered if there are at least 2 points (a single point isn't a
// "trend," it's just the current price restated).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Tag,
    Users,
    Heart,
    Sparkles,
    History,
    TrendingUp,
    X
} from "lucide-react";
import {
    getMarketplaceCardDetail,
    buyMarketplaceListing,
    ApiResponseError,
    type MarketplaceCardDetail
} from "../../../../lib/api";
import { useCurrency } from "../../../components/CurrencyContext";
import { CurrencyIcon } from "../../../components/CurrencyIcon";

const RARITY_COLORS: Record<string, string> = {
    C: "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.5)]",
    R: "border-[rgba(120,200,150,0.35)] text-[#7fd39c]",
    SR: "border-[rgba(90,160,230,0.4)] text-[#6fb2f0]",
    SSR: "border-[rgba(190,110,230,0.45)] text-[#c98af0]",
    UR: "border-[rgba(230,180,60,0.55)] text-[#f0c445]"
};

const METHOD_LABELS: Record<string, string> = {
    market: "Bought on Marketplace",
    trade: "Traded",
    gacha: "Pulled",
    drop: "Won in Minigame",
    admin: "Granted",
    event: "Claimed at Event"
};

function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function fmtDateShort(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    });
}

type BuyPhase = "detail" | "confirm" | "buying" | "success" | "fail";

// ── Full-bleed card media — no forced background, no crop box ──────
// Renders at its own natural aspect ratio, constrained only by a max
// height. object-contain (not object-cover) so nothing gets cropped —
// the whole point is showing the complete card art edge to edge.
function CardMedia({
    card,
    className = ""
}: {
    card: MarketplaceCardDetail["card"];
    className?: string;
}) {
    if (!card) {
        return (
            <div
                className={`flex items-center justify-center text-[rgba(200,168,75,0.25)] ${className}`}
            >
                <Sparkles className="h-10 w-10" />
            </div>
        );
    }
    return card.mediaType === "video" ? (
        <video
            src={card.mediaUrl}
            className={`h-full w-full object-contain ${className}`}
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
            className={`h-full w-full object-contain ${className}`}
        />
    );
}

// ── Price history graph ──────────────────────────────────────────────
// Lightweight inline SVG line chart — no charting library needed for a
// single-series trend line. Only renders if there are 2+ points (a
// lone point is just "the current price," not a trend worth graphing).
function PriceHistoryGraph({
    points
}: {
    points: MarketplaceCardDetail["priceHistory"];
}) {
    if (points.length < 2) return null;

    const width = 320;
    const height = 80;
    const padding = 8;
    const prices = points.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1; // avoid divide-by-zero if price never changed

    const coords = points.map((p, i) => {
        const x = padding + (i / (points.length - 1)) * (width - padding * 2);
        const y =
            height -
            padding -
            ((p.price - min) / range) * (height - padding * 2);
        return { x, y, price: p.price };
    });

    const linePath = coords
        .map(
            (c, i) =>
                `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
        )
        .join(" ");
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padding} L ${coords[0].x.toFixed(1)} ${height - padding} Z`;

    const trendingUp = prices[prices.length - 1] >= prices[0];

    return (
        <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-[rgba(200,168,75,0.4)]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.5)]">
                        Price History
                    </span>
                </div>
                <span
                    className={`text-[10px] font-bold ${trendingUp ? "text-[#7fd39c]" : "text-[#e08a8a]"}`}
                >
                    {trendingUp ? "↑" : "↓"} {formatNumber(min)}–
                    {formatNumber(max)}
                </span>
            </div>
            <div className="rounded-md border border-[rgba(200,168,75,0.12)] bg-[rgba(200,168,75,0.03)] p-2">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-20 w-full"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient
                            id="priceAreaGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="#c8a84b"
                                stopOpacity="0.35"
                            />
                            <stop
                                offset="100%"
                                stopColor="#c8a84b"
                                stopOpacity="0"
                            />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#priceAreaGrad)" />
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#c8a84b"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    {coords.map((c, i) => (
                        <circle
                            key={i}
                            cx={c.x}
                            cy={c.y}
                            r="1.8"
                            fill="#e6c96a"
                        />
                    ))}
                </svg>
                <div className="mt-1 flex justify-between text-[9px] text-[rgba(200,168,75,0.35)]">
                    <span>{fmtDateShort(points[0].recordedAt)}</span>
                    <span>
                        {fmtDateShort(points[points.length - 1].recordedAt)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function MarketplaceCardDetailPage() {
    const params = useParams<{ instanceId: string }>();
    const router = useRouter();
    const { kitsu, refresh } = useCurrency();

    const [detail, setDetail] = useState<MarketplaceCardDetail | null>(null);
    const [loadError, setLoadError] = useState("");
    const [phase, setPhase] = useState<BuyPhase>("detail");
    const [failMsg, setFailMsg] = useState("");

    useEffect(() => {
        let cancelled = false;
        getMarketplaceCardDetail(params.instanceId)
            .then(res => {
                if (!cancelled) setDetail(res);
            })
            .catch(err => {
                if (cancelled) return;
                setLoadError(
                    err instanceof ApiResponseError && err.status === 404
                        ? "This listing no longer exists — it may have been sold or cancelled."
                        : "Couldn't load this card. Try refreshing."
                );
            });
        return () => {
            cancelled = true;
        };
    }, [params.instanceId]);

    const handleConfirm = async () => {
        setPhase("buying");
        try {
            await buyMarketplaceListing(params.instanceId);
            refresh();
            setPhase("success");
        } catch (err) {
            const message =
                err instanceof ApiResponseError
                    ? (err.error.message ?? "Purchase failed.")
                    : "Purchase failed. Try again.";
            setFailMsg(message);
            setPhase("fail");
        }
    };

    if (loadError) {
        return (
            <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-sm text-[rgba(200,168,75,0.5)]">
                    {loadError}
                </p>
                <button
                    type="button"
                    onClick={() => router.push("/marketplace")}
                    className="brush-btn w-48"
                >
                    Back to Marketplace
                </button>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center">
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
            </div>
        );
    }

    const card = detail.card;
    const rarityClass = card ? RARITY_COLORS[card.rarity] : RARITY_COLORS.C;
    const price = detail.listing?.price ?? 0;
    const canAfford = kitsu === null || kitsu >= price;
    const sellerName =
        detail.history[detail.history.length - 1]?.ownerName ?? null;
    const visibleHistory = detail.history.slice().reverse().slice(0, 8);
    const notListed = !detail.listing;

    return (
        <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-24 pt-4">
            {/* ── Header ── */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b]"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
                    Card Details
                </h1>
            </div>

            {/* ── Card media — full size, no crop box, no black matte ── */}
            <div className="flex justify-center">
                <div className="max-h-[52vh] max-w-full">
                    <CardMedia
                        card={card}
                        className="max-h-[52vh] rounded-lg"
                    />
                </div>
            </div>

            {/* ── Identity ── */}
            <div className="flex flex-col items-center gap-1 text-center">
                <span
                    className={`inline-block rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${rarityClass}`}
                >
                    {card?.rarity}
                </span>
                <p className="text-lg font-semibold leading-tight text-[#f0e6c8]">
                    {card?.name}
                </p>
                <p className="text-sm text-[rgba(200,168,75,0.5)]">
                    {card?.seriesName}
                </p>
                <p className="text-[11px] text-[rgba(200,168,75,0.35)]">
                    Copy #{detail.issueNumber}
                </p>
            </div>

            {/* ── Price + buy ── */}
            {notListed ? (
                <div className="border border-[rgba(200,168,75,0.15)] bg-[rgba(200,168,75,0.03)] px-4 py-3 text-center text-xs text-[rgba(200,168,75,0.5)]">
                    This card isn&apos;t currently listed for sale.
                </div>
            ) : (
                <div className="flex items-center justify-between border-t border-b border-[rgba(200,168,75,0.12)] py-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                        Price
                    </span>
                    <span className="flex items-center gap-1.5 text-xl font-bold text-[#e6c96a]">
                        <CurrencyIcon type="kitsu" size={20} />
                        {formatNumber(price)}
                    </span>
                </div>
            )}

            {/* ── Seller ── */}
            <div className="flex items-center gap-2.5 rounded-md border border-[rgba(200,168,75,0.12)] bg-[rgba(200,168,75,0.03)] px-3 py-2.5">
                <Tag className="h-3.5 w-3.5 shrink-0 text-[rgba(200,168,75,0.5)]" />
                <p className="min-w-0 truncate text-xs text-[rgba(200,168,75,0.7)]">
                    Listed by{" "}
                    <span className="font-semibold text-[#f0e6c8]">
                        {sellerName ?? "a player"}
                    </span>
                </p>
            </div>

            {/* ── Stats ── */}
            {card && (
                <div className="grid grid-cols-3 gap-2">
                    {[
                        {
                            icon: Users,
                            label: "Owners",
                            value: formatNumber(card.ownerCount)
                        },
                        {
                            icon: Heart,
                            label: "Wishlisted",
                            value: formatNumber(detail.wishlistCount)
                        },
                        {
                            icon: Sparkles,
                            label: "Issued",
                            value: formatNumber(card.totalIssued)
                        }
                    ].map(s => (
                        <div
                            key={s.label}
                            className="flex flex-col items-center gap-1 rounded-md border border-[rgba(200,168,75,0.12)] py-2.5 text-center"
                        >
                            <s.icon className="h-3.5 w-3.5 text-[rgba(200,168,75,0.45)]" />
                            <span className="text-sm font-bold text-[#e6c96a]">
                                {s.value}
                            </span>
                            <span className="text-[8px] uppercase tracking-widest text-[rgba(200,168,75,0.4)]">
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Price history graph ── */}
            <PriceHistoryGraph points={detail.priceHistory} />

            {/* ── Ownership history ── */}
            <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                    <History className="h-3 w-3 text-[rgba(200,168,75,0.4)]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.5)]">
                        Ownership History
                    </span>
                </div>
                {visibleHistory.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[rgba(200,168,75,0.4)]">
                        No history yet.
                    </p>
                ) : (
                    visibleHistory.map((event, i) => (
                        <div
                            key={`${event.ownerId}-${event.acquiredAt}`}
                            className="trade-row-in flex items-center gap-2.5 border-b border-[rgba(200,168,75,0.08)] py-2.5 last:border-0"
                            style={{
                                animationDelay: `${Math.min(i, 10) * 40}ms`
                            }}
                        >
                            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[rgba(200,168,75,0.1)]">
                                {event.ownerAvatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={event.ownerAvatarUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[rgba(200,168,75,0.5)]">
                                        {event.ownerName
                                            .slice(0, 1)
                                            .toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-[#f0e6c8]">
                                    {event.ownerName}
                                </p>
                                <p className="truncate text-[10px] text-[rgba(200,168,75,0.4)]">
                                    {METHOD_LABELS[event.method] ??
                                        event.method}
                                    {event.fromOwnerName
                                        ? ` from ${event.fromOwnerName}`
                                        : ""}
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
                    ))
                )}
            </div>

            {/* ── Sticky buy button ── */}
            {/* [FIXED] Was z-20 at bottom-0 — BottomNav is z-40 fixed at
          bottom-0 (see BottomNav.tsx), so this button was rendering
          completely UNDER the nav bar: invisible and unclickable, not
          just visually behind it. Fixed: z-50 (above BottomNav's z-40)
          and bottom-16 instead of bottom-0 — same offset BottomNav's
          own dropup menu uses for itself (BottomNav.tsx line ~143),
          so this sits directly above the nav bar rather than guessing
          its exact pixel height (which isn't a fixed class — it comes
          from content padding + safe-area-inset, not hardcodable). */}
            {!notListed && (
                <div className="fixed inset-x-0 bottom-16 z-50 border-t border-[rgba(200,168,75,0.2)] bg-[#0d0c00]/95 px-4 py-3 backdrop-blur-sm">
                    <div className="mx-auto max-w-lg">
                        <button
                            type="button"
                            onClick={() => setPhase("confirm")}
                            className="h-11 w-full border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black transition-[filter] hover:brightness-110"
                        >
                            Buy for {formatNumber(price)} Kitsu
                        </button>
                    </div>
                </div>
            )}

            {/* ── Confirm / buying / success / fail overlay ── */}
            {phase !== "detail" && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={e => {
                        if (e.target === e.currentTarget && phase === "confirm")
                            setPhase("detail");
                    }}
                >
                    <div className="craft-modal-pop m-4 w-full max-w-sm border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8]">
                        {phase === "confirm" && (
                            <>
                                <div className="flex items-center gap-2 border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
                                    <h2 className="flex-1 font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
                                        Confirm Purchase
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => setPhase("detail")}
                                        aria-label="Close"
                                        className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-4 px-5 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="h-24 w-20 shrink-0">
                                            <CardMedia
                                                card={card}
                                                className="rounded-md"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[#f0e6c8]">
                                                {card?.name}
                                            </p>
                                            <p className="truncate text-xs text-[rgba(200,168,75,0.5)]">
                                                {card?.seriesName}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-[rgba(200,168,75,0.35)]">
                                                Copy #{detail.issueNumber}
                                            </p>
                                        </div>
                                    </div>
                                    {!canAfford && (
                                        <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                            You don&apos;t have enough Kitsu for
                                            this listing.
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
                                <div className="reveal-pop relative flex h-28 w-24 items-center justify-center">
                                    <div className="reveal-glow-pulse absolute inset-0 rounded-full bg-[#c8a84b]/20 blur-xl" />
                                    <div className="relative h-24 w-20">
                                        <CardMedia
                                            card={card}
                                            className="rounded-md"
                                        />
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
                                    <p className="mt-1 text-sm text-[#f0e6c8]">
                                        {card?.name}
                                    </p>
                                    <p className="text-xs text-[rgba(200,168,75,0.45)]">
                                        now in your collection
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => router.push("/marketplace")}
                                    className="brush-btn w-40"
                                >
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
                                <button
                                    type="button"
                                    onClick={() => setPhase("detail")}
                                    className="brush-btn w-40"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
