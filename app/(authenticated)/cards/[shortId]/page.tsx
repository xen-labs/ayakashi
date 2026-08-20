"use client";

import { useEffect, useState, use as usePromise } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import {
    getCardDetail,
    getCardPriceHistory,
    toggleCardWishlist,
    ApiResponseError
} from "../../../../lib/api";
import type { CardDetailResponse, CardPricePoint } from "../../../../lib/api";

function fmt(n: number | null | undefined) {
    if (n == null) return "—";
    return n.toLocaleString("en-US");
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    });
}

function PriceChart({ points }: { points: CardPricePoint[] }) {
    if (points.length < 2) {
        return (
            <p className="py-8 text-center text-xs text-[rgba(200,168,75,0.40)]">
                Not enough price history yet to chart a trend.
            </p>
        );
    }

    const data = points.map(p => ({
        date: fmtDate(p.recordedAt),
        price: p.price
    }));

    return (
        <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                    <XAxis
                        dataKey="date"
                        tick={{ fill: "rgba(200,168,75,0.45)", fontSize: 10 }}
                        axisLine={{ stroke: "rgba(200,168,75,0.15)" }}
                        tickLine={false}
                        minTickGap={24}
                    />
                    <YAxis
                        tick={{ fill: "rgba(200,168,75,0.45)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#0d0c00",
                            border: "1px solid rgba(200,168,75,0.3)",
                            borderRadius: 0,
                            fontSize: 12
                        }}
                        labelStyle={{ color: "#c8a84b" }}
                        itemStyle={{ color: "#f0e6c8" }}
                        formatter={(value: number) => [fmt(value), "Price"]}
                    />
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#c8a84b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "#e6c96a" }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── Clickable player identity chip — used for both owners and wishlisters ──
function PlayerChip({
    player,
    size = 28
}: {
    player: {
        username: string | null;
        displayName: string;
        avatarUrl: string | null;
    };
    size?: number;
}) {
    const content = (
        <>
            <div
                className="shrink-0 overflow-hidden rounded-full bg-[rgba(200,168,75,0.1)]"
                style={{ width: size, height: size }}
            >
                {player.avatarUrl ? (
                    <Image
                        src={player.avatarUrl}
                        alt=""
                        width={size}
                        height={size}
                        className="h-full w-full object-cover"
                        unoptimized
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[rgba(200,168,75,0.5)]">
                        {player.displayName.slice(0, 1).toUpperCase()}
                    </div>
                )}
            </div>
            <div className="min-w-0">
                <p className="truncate text-xs text-[#f0e6c8]">
                    {player.displayName}
                </p>
                {player.username && (
                    <p className="truncate text-[10px] text-[rgba(200,168,75,0.4)]">
                        @{player.username}
                    </p>
                )}
            </div>
        </>
    );

    // Only players with a resolvable username can be linked — a null
    // username means the WebAccount lookup failed to resolve (shouldn't
    // normally happen, but the backend types allow it), so fall back to
    // a non-interactive chip rather than link to a broken profile URL.
    if (!player.username) {
        return (
            <div className="flex min-w-0 items-center gap-2.5">{content}</div>
        );
    }

    return (
        <Link
            href={`/profile/${player.username}`}
            className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-75"
        >
            {content}
        </Link>
    );
}

function OwnerRow({ owner }: { owner: CardDetailResponse["owners"][number] }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(200,168,75,0.08)] py-2.5 last:border-0">
            <PlayerChip player={owner.player} />
            <div className="shrink-0 text-right">
                <p className="text-xs font-bold text-[#c8a84b]">
                    #{owner.issueNumber}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
                    {owner.condition}
                </p>
            </div>
        </div>
    );
}

export default function CardDetailPage({
    params
}: {
    params: Promise<{ shortId: string }>;
}) {
    const { shortId } = usePromise(params);
    const router = useRouter();

    const [data, setData] = useState<CardDetailResponse | null>(null);
    const [pricePoints, setPricePoints] = useState<CardPricePoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showAllOwners, setShowAllOwners] = useState(false);
    const [showAllWishlisters, setShowAllWishlisters] = useState(false);
    const [wishlisted, setWishlisted] = useState(false);
    const [wishBusy, setWishBusy] = useState(false);
    // Hero art loading placeholder — see CardTile.tsx for full reasoning.
    const [heroArtLoaded, setHeroArtLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        Promise.allSettled([
            getCardDetail(shortId),
            getCardPriceHistory(shortId)
        ]).then(([detailRes, priceRes]) => {
            if (cancelled) return;
            if (detailRes.status === "fulfilled") setData(detailRes.value);
            else if (
                detailRes.reason instanceof ApiResponseError &&
                detailRes.reason.status === 401
            ) {
                router.push("/login");
                return;
            } else {
                setError("Couldn't load this card. Try refreshing.");
            }
            if (priceRes.status === "fulfilled")
                setPricePoints(priceRes.value.points);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [shortId, router]);

    const handleWishlist = async () => {
        if (wishBusy) return;
        const next = !wishlisted;
        setWishlisted(next);
        setWishBusy(true);
        try {
            const res = await toggleCardWishlist(shortId);
            setWishlisted(res.wishlisted);
        } catch {
            setWishlisted(!next);
        } finally {
            setWishBusy(false);
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

    if (error || !data)
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
                <p className="text-sm text-[rgba(200,168,75,0.60)]">
                    {error || "Card not found."}
                </p>
                <Link href="/cards" className="brush-btn w-48">
                    Back to Catalog
                </Link>
            </div>
        );

    const { card, owners, wishlistedBy, seriesSiblings } = data;
    const visibleOwners = showAllOwners ? owners : owners.slice(0, 8);
    const visibleWishlisters = showAllWishlisters
        ? wishlistedBy
        : wishlistedBy.slice(0, 24);
    const isUR = card.rarity === "UR";
    const isVideo = card.fileExtension === "webm";

    return (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
            <Link
                href="/cards"
                className="w-fit text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(200,168,75,0.55)] transition-colors hover:text-[#c8a84b]"
            >
                ← Back to Catalog
            </Link>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
                {/* ── Card media — full size, no crop box, no black matte ── */}
                <div>
                    <div
                        className={`relative flex justify-center ${isUR ? "welcome-bonus-card" : ""}`}
                    >
                        <div className="relative aspect-[3/4] max-h-[52vh] w-full">
                            {/* Loading placeholder — see CardTile.tsx for
                                full reasoning. */}
                            <img
                                src="/cardback/cardback-neutral.webp"
                                alt=""
                                aria-hidden="true"
                                className={`absolute inset-0 z-0 h-full w-full object-contain transition-opacity duration-300 ${
                                    heroArtLoaded ? "opacity-0" : "opacity-100"
                                }`}
                            />
                            {isVideo ? (
                                <video
                                    src={card.mediaUrl}
                                    className={`relative z-[1] h-full w-full object-contain transition-opacity duration-300 ${
                                        heroArtLoaded
                                            ? "opacity-100"
                                            : "opacity-0"
                                    }`}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    onLoadedData={() => setHeroArtLoaded(true)}
                                />
                            ) : (
                                // Plain <img> for gif/webp/png/jpg — next/image's
                                // optimizer isn't guaranteed to preserve GIF/animated-
                                // webp animation, and this is a single hero image so the
                                // optimization tradeoff isn't worth losing the motion for.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={card.mediaUrl}
                                    alt={card.name}
                                    className={`relative z-[1] h-full w-full object-contain transition-opacity duration-300 ${
                                        heroArtLoaded
                                            ? "opacity-100"
                                            : "opacity-0"
                                    }`}
                                    onLoad={() => setHeroArtLoaded(true)}
                                    ref={img => {
                                        if (img?.complete)
                                            setHeroArtLoaded(true);
                                    }}
                                />
                            )}
                        </div>
                        {/* A single foil sweep on load for the rarest tier only —
                a moment, not persistent decoration on every card. */}
                        {isUR && (
                            <div className="welcome-bonus-shimmer pointer-events-none absolute inset-0" />
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleWishlist}
                        disabled={wishBusy}
                        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
                            wishlisted
                                ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                : "border-[rgba(200,168,75,0.30)] text-[rgba(200,168,75,0.60)] hover:border-red-500/50 hover:text-red-400"
                        }`}
                    >
                        <Heart
                            className={`h-4 w-4 ${wishlisted ? "fill-red-400" : ""}`}
                        />
                        {wishlisted ? "Wishlisted" : "Add to Wishlist"}
                    </button>
                </div>

                {/* ── Info ── */}
                <div className="flex flex-col gap-6">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c8a84b]">
                            {card.rarity}
                            {card.isEvent && card.eventName
                                ? ` · ${card.eventName}`
                                : ""}
                        </span>
                        <h1 className="font-display mt-1 text-2xl font-bold uppercase tracking-[0.03em] text-[#f0e6c8] sm:text-3xl">
                            {card.name}
                        </h1>
                        <p className="mt-1 text-sm text-[rgba(200,168,75,0.55)]">
                            {card.seriesName}
                        </p>
                        {card.isCustom && card.creatorCredit && (
                            <p className="mt-1 text-xs text-[rgba(200,168,75,0.35)]">
                                Custom art by {card.creatorCredit}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                            {
                                label: "Current Price",
                                value: fmt(card.currentPrice)
                            },
                            { label: "Owners", value: fmt(card.ownerCount) },
                            { label: "Issued", value: fmt(card.totalIssued) },
                            {
                                label: "Wishlisted",
                                value: fmt(card.wishlistCount)
                            }
                        ].map(s => (
                            <div
                                key={s.label}
                                className="form-card flex flex-col items-center gap-1 border p-3 text-center"
                            >
                                <span className="text-base font-bold text-[#e6c96a]">
                                    {s.value}
                                </span>
                                <span className="text-[9px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* ── Price history ── */}
                    <div className="form-card border p-4">
                        <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-[0.12em] text-[#c8a84b]">
                            Price History
                        </h2>
                        <PriceChart points={pricePoints} />
                    </div>
                </div>
            </div>

            <hr className="gold-rule" />

            {/* ── Owners ── */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <div className="section-header !mb-0">
                        <span className="section-header-text">
                            Owners ({owners.length})
                        </span>
                    </div>
                </div>
                {owners.length === 0 ? (
                    <p className="text-center text-sm text-[rgba(200,168,75,0.40)]">
                        No one owns a copy of this card yet.
                    </p>
                ) : (
                    <>
                        <div className="form-card border p-4">
                            {visibleOwners.map(o => (
                                <OwnerRow
                                    key={`${o.player.username}-${o.issueNumber}`}
                                    owner={o}
                                />
                            ))}
                        </div>
                        {owners.length > 8 && (
                            <button
                                type="button"
                                onClick={() => setShowAllOwners(v => !v)}
                                className="mt-3 text-xs font-semibold text-[rgba(200,168,75,0.55)] underline underline-offset-2 transition-colors hover:text-[#c8a84b]"
                            >
                                {showAllOwners
                                    ? "Show fewer"
                                    : `Show all ${owners.length}`}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* ── Wishlisted by ── */}
            {wishlistedBy.length > 0 && (
                <>
                    <hr className="gold-rule" />
                    <div>
                        <div className="section-header mb-4">
                            <span className="section-header-text">
                                Wishlisted By ({wishlistedBy.length})
                            </span>
                        </div>
                        <div className="form-card border p-4">
                            {visibleWishlisters.map(w => (
                                <div
                                    key={`${w.player.username}-${w.wishlistedAt}`}
                                    className="flex items-center justify-between gap-3 border-b border-[rgba(200,168,75,0.08)] py-2.5 last:border-0"
                                >
                                    <PlayerChip player={w.player} size={26} />
                                    <p className="shrink-0 text-[10px] text-[rgba(200,168,75,0.35)]">
                                        {fmtDate(w.wishlistedAt)}
                                    </p>
                                </div>
                            ))}
                        </div>
                        {wishlistedBy.length > 24 && (
                            <button
                                type="button"
                                onClick={() => setShowAllWishlisters(v => !v)}
                                className="mt-3 text-xs font-semibold text-[rgba(200,168,75,0.55)] underline underline-offset-2 transition-colors hover:text-[#c8a84b]"
                            >
                                {showAllWishlisters
                                    ? "Show fewer"
                                    : `Show all ${wishlistedBy.length}`}
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* ── Series siblings ── */}
            {seriesSiblings.length > 0 && (
                <>
                    <hr className="gold-rule" />
                    <div>
                        <div className="section-header mb-5">
                            <span className="section-header-text">
                                More from {card.seriesName}
                            </span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {seriesSiblings.map(s => (
                                <Link
                                    key={s.shortId}
                                    href={`/cards/${s.shortId}`}
                                    className="w-28 shrink-0"
                                >
                                    <div className="relative aspect-[3/4] w-full">
                                        <Image
                                            src={s.thumbUrl}
                                            alt={s.name}
                                            fill
                                            sizes="112px"
                                            className="object-contain"
                                            unoptimized
                                        />
                                        <span className="absolute left-1 top-1 rounded-sm bg-black/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#c8a84b]">
                                            {s.rarity}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
