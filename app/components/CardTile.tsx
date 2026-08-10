"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
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
 * rarity ring, no overlay frame (the cards already have their own art
 * and frames). The one piece of interaction chrome is the pointer-
 * tracked 3D lift: tilt follows exactly where the pointer is over the
 * card, like picking it up off a table, with a soft specular sheen
 * that moves with it. Falls back to a flat hover/press lift wherever
 * pointer position isn't available (keyboard focus, coarse pointers
 * that don't fire granular move events).
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
  onWishlistToggle,
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
      ["--sheen-y" as string]: `${py * 100}%`,
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
        className={`card-tile relative overflow-hidden rounded-md bg-black ${active ? "is-active" : ""}`}
        style={style}
      >
        <div className="relative aspect-[3/4] w-full">
          {isVideo ? (
            <video
              src={card.thumbUrl}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // Plain <img>, not next/image, for every format here — gif
            // and animated webp need to keep their native animation,
            // which next/image's optimizer isn't guaranteed to preserve.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.thumbUrl}
              alt={card.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}

          {/* sheen — tracks pointer via CSS vars set above */}
          <div className="card-tile-sheen absolute inset-0" />

          {/* rarity tag — quiet, corner, informational only */}
          <span className="absolute left-1.5 top-1.5 rounded-sm bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#c8a84b]">
            {card.rarity}
          </span>

          <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
            {card.isEvent && (
              <span className="rounded-sm bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#e6c96a]">
                ✦
              </span>
            )}
            <button
              type="button"
              onClick={handleWishlist}
              aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
              className="rounded-sm bg-black/70 p-1 transition-transform active:scale-90"
            >
              <Heart
                className={`h-3 w-3 ${liked ? "fill-red-400 text-red-400" : "text-[rgba(200,168,75,0.55)]"}`}
              />
            </button>
          </div>

          {/* name/series scrim */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-6">
            <p className="truncate font-ui text-xs font-semibold text-[#f0e6c8]">
              {card.name}
            </p>
            <p className="truncate text-[10px] text-[rgba(200,168,75,0.55)]">
              {card.seriesName}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
