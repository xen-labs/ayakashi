"use client";

import Image from "next/image";
import Link from "next/link";
import {
    useCallback,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent
} from "react";
import { Heart } from "lucide-react";
import { toggleCardWishlist } from "../../lib/api";

const MAX_TILT_DEG = 10;

export interface CardTileData {
    shortId: string;
    name: string;
    seriesName: string;
    rarity: "C" | "R" | "SR" | "SSR" | "UR";
    isEvent: boolean;
    eventName: string | null;
    thumbUrl: string;
    mediaType: string;
    fileExtension: "png" | "gif" | "webp" | "webm" | "jpg" | "jpeg";
    ownerCount: number;
    wishlistCount: number;
    totalIssued: number;
}

/**
 * A single catalog tile. The art carries all the visual weight — no
 * rarity ring, no black frame or backing (the cards already ship with
 * their own alpha-channel edges, so a black matte just shows as an
 * unwanted box around the art). No name/series label either — the art
 * is the whole tile; identity only shows once you open the card. The
 * one piece of interaction chrome is the pointer-tracked 3D lift: tilt
 * follows exactly where the pointer is over the card, like picking it
 * up off a table, with a soft specular sheen that moves with it. Falls
 * back to a flat hover/press lift wherever pointer position isn't
 * available (keyboard focus, coarse pointers that don't fire granular
 * move events).
 *
 * Media: mediaType is only ever "image" | "video" (never "animated" —
 * see db/models/Card.ts) — branching on that alone previously routed
 * EVERY card, including animated gif/webp AND webm video, through
 * next/image, which can't decode webm at all (renders black) and can
 * strip GIF animation. Now branches on fileExtension instead: webm
 * gets a real <video> tag; gif/webp/png/jpg all render as plain <img>
 * (not next/image) so animated formats actually animate.
 */
export function CardTile({
    card,
    wishlisted = false,
    onWishlistToggle
}: {
    card: CardTileData;
    wishlisted?: boolean;
    onWishlistToggle?: (shortId: string, nowWishlisted: boolean) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<CSSProperties>({});
    const [active, setActive] = useState(false);
    const [liked, setLiked] = useState(wishlisted);
    const [wishBusy, setWishBusy] = useState(false);
    // Starts false so the card-back placeholder shows immediately on mount
    // instead of racing the image request — the point of a loading state is
    // covering that exact gap. Real art crossfades in once it actually
    // finishes loading (onLoad/onLoadedData), not on a timer, so a
    // cached/instant load never shows the card-back flash at all.
    const [artLoaded, setArtLoaded] = useState(false);

    const updateFromPoint = useCallback((clientX: number, clientY: number) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const px = (clientX - rect.left) / rect.width; // 0..1
        const py = (clientY - rect.top) / rect.height; // 0..1

        const rotateY = (px - 0.5) * MAX_TILT_DEG * 2;
        const rotateX = (0.5 - py) * MAX_TILT_DEG * 2;

        setStyle({
            transform: `translateY(-6px) scale(1.04) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            ["--sheen-x" as string]: `${px * 100}%`,
            ["--sheen-y" as string]: `${py * 100}%`
        });
    }, []);

    const handlePointerMove = (e: PointerEvent<HTMLAnchorElement>) => {
        if (e.pointerType === "mouse" || e.pointerType === "pen") {
            updateFromPoint(e.clientX, e.clientY);
        }
    };

    const handlePointerEnter = (e: PointerEvent<HTMLAnchorElement>) => {
        setActive(true);
        if (e.pointerType === "touch") updateFromPoint(e.clientX, e.clientY);
    };

    const handlePointerDown = (e: PointerEvent<HTMLAnchorElement>) => {
        setActive(true);
        updateFromPoint(e.clientX, e.clientY);
    };

    const reset = () => {
        setActive(false);
        setStyle({});
    };

    const handleWishlist = async (e: React.MouseEvent) => {
        e.preventDefault(); // don't navigate to the detail page
        e.stopPropagation();
        if (wishBusy) return;
        const next = !liked;
        setLiked(next); // optimistic
        setWishBusy(true);
        try {
            const res = await toggleCardWishlist(card.shortId);
            setLiked(res.wishlisted);
            onWishlistToggle?.(card.shortId, res.wishlisted);
        } catch {
            setLiked(!next); // revert — likely 404 until the backend route ships
        } finally {
            setWishBusy(false);
        }
    };

    const isVideo = card.fileExtension === "webm";

    return (
        <Link
            href={`/cards/${card.shortId}`}
            className="card-tile-wrap block"
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={reset}
            onPointerLeave={reset}
            onPointerCancel={reset}
        >
            <div
                ref={ref}
                className={`card-tile relative overflow-hidden ${active ? "is-active" : ""}`}
                style={style}
            >
                <div className="relative aspect-[3/4] w-full">
                    {/* Loading placeholder — the card-back art, shown underneath
              until the real thumbnail/video actually finishes loading.
              Plain <img>, not next/image: this is a small static local
              asset, next/image's optimization pipeline buys nothing here
              and only adds a loader round-trip for something that should
              be instant. z-0 so it's always behind the real art layer;
              opacity (not unmount) so the crossfade has something to
              transition against. */}
                    <img
                        src="/cardback/cardback-neutral.webp"
                        alt=""
                        aria-hidden="true"
                        className={`absolute inset-0 z-0 h-full w-full object-contain transition-opacity duration-300 ${
                            artLoaded ? "opacity-0" : "opacity-100"
                        }`}
                    />
                    {isVideo ? (
                        <video
                            src={card.thumbUrl}
                            className={`relative z-[1] h-full w-full object-contain transition-opacity duration-300 ${
                                artLoaded ? "opacity-100" : "opacity-0"
                            }`}
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="metadata"
                            onLoadedData={() => setArtLoaded(true)}
                        />
                    ) : (
                        // Plain <img>, not next/image, for every format here — gif
                        // and animated webp need to keep their native animation,
                        // which next/image's optimizer isn't guaranteed to preserve.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={card.thumbUrl}
                            alt={card.name}
                            className={`relative z-[1] h-full w-full object-contain transition-opacity duration-300 ${
                                artLoaded ? "opacity-100" : "opacity-0"
                            }`}
                            loading="lazy"
                            onLoad={() => setArtLoaded(true)}
                            ref={img => {
                                // Cache-safety net: a cached image can already be
                                // .complete by the time this ref runs, in which case
                                // onLoad never fires again and the placeholder would be
                                // stuck showing forever underneath a fully-loaded image.
                                if (img?.complete) setArtLoaded(true);
                            }}
                        />
                    )}

                    {/* sheen — tracks pointer via CSS vars set above. z-[2]
                        so it always sits above BOTH art layers (card-back
                        placeholder at z-0, real art at z-1) regardless of
                        which one is currently visible — previously had no
                        explicit z-index, which put it at the same
                        stacking level as the placeholder and let the real
                        art layer cover it once loaded. */}
                    <div className="card-tile-sheen absolute inset-0 z-[2]" />

                    {/* rarity tag — quiet, corner, informational only.
                        Same z-[2] fix as the sheen above — this and the
                        wishlist badge were rendering BETWEEN the
                        card-back placeholder and the real art instead of
                        above both. */}
                    <span className="absolute left-1.5 top-1.5 z-[2] rounded-sm bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#c8a84b]">
                        {card.rarity}
                    </span>

                    <div className="absolute right-1.5 top-1.5 z-[2] flex items-center gap-1">
                        {card.isEvent && (
                            <span className="rounded-sm bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#e6c96a]">
                                ✦
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleWishlist}
                            aria-label={
                                liked
                                    ? "Remove from wishlist"
                                    : "Add to wishlist"
                            }
                            className="rounded-sm bg-black/70 p-1 transition-transform active:scale-90"
                        >
                            <Heart
                                className={`h-3 w-3 ${liked ? "fill-red-400 text-red-400" : "text-[rgba(200,168,75,0.55)]"}`}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </Link>
    );
}
