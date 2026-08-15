"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CurrencyIcon } from "./CurrencyIcon";
import { getMarketplaceListings } from "../../lib/api";
import type { MarketplaceListing, CatalogCardRarity } from "../../lib/api";

// Maps the real rarity codes (C/R/SR/SSR/UR) onto the existing
// .rarity-ring-* classes already defined in globals.css.
const RARITY_RING: Record<CatalogCardRarity, string> = {
  C: "rarity-ring-common",
  R: "rarity-ring-uncommon",
  SR: "rarity-ring-rare",
  SSR: "rarity-ring-epic",
  UR: "rarity-ring-legendary",
};

const RARITY_LABEL: Record<CatalogCardRarity, string> = {
  C: "Common",
  R: "Rare",
  SR: "Super Rare",
  SSR: "SS Rare",
  UR: "Ultra Rare",
};

/**
 * MarketplaceDeals — a horizontal preview strip of live marketplace
 * listings, sorted to surface the most eye-catching cards first
 * (highest rarity, then newest). Silently renders nothing on failure
 * or empty results.
 */
export function MarketplaceDeals() {
  const [listings, setListings] = useState<MarketplaceListing[] | null>(null);

  useEffect(() => {
    getMarketplaceListings({ sort: "rarity", page: 1 })
      .then((res) => setListings(res.listings))
      .catch(() => setListings([]));
  }, []);

  if (listings === null) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="form-card h-64 w-40 shrink-0 animate-pulse border opacity-40"
          />
        ))}
      </div>
    );
  }

  if (listings.length === 0) return null;

  return (
    <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
      {listings.slice(0, 10).map((listing, i) => {
        const card = listing.card;
        const ringClass = card
          ? RARITY_RING[card.rarity]
          : "rarity-ring-common";
        return (
          <Link
            key={listing.instanceId}
            href={`/marketplace/card/${listing.instanceId}`}
            className="item-card-lift form-card stagger-in w-40 shrink-0 border p-3"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div
              className={`relative aspect-square w-full overflow-hidden rounded-sm bg-black/40 ${ringClass}`}
            >
              {card?.mediaUrl &&
                (card.mediaType?.startsWith("video") ? (
                  <video
                    src={card.mediaUrl}
                    className="h-full w-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.mediaUrl}
                    alt={card.name}
                    className="h-full w-full object-cover"
                  />
                ))}
              {card && (
                <span className="absolute left-1.5 top-1.5 border border-[rgba(200,168,75,0.35)] bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#c8a84b]">
                  {RARITY_LABEL[card.rarity]}
                </span>
              )}
            </div>
            <p className="font-ui mt-2 truncate text-xs font-semibold text-[#f0e6c8]">
              {card?.name ?? "Unknown Card"}
            </p>
            <p className="truncate text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.4)]">
              {card?.seriesName ?? ""}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <CurrencyIcon type="kitsu" size={16} />
              <span className="font-display text-sm font-bold text-[#c8a84b]">
                {listing.price.toLocaleString("en-US")}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
