"use client";

/**
 * DeckShowcase — a live HTML/CSS mirror of the backend's DeckCard.ts
 * (the WhatsApp-chat deck image renderer): same 4x3 grid, same header
 * kicker/name treatment, same footer count/tag, same top/bottom tint
 * fades over the background image.
 *
 * Deliberately NOT a fetch of GET /deck/:jid/card — that route is
 * bot-only (shared-secret gated, see routes/deckCard.ts) and, more
 * importantly, produces a STATIC composited image by design (its own
 * header comment: "this renderer never sends anything but a still
 * frame"). The website can do better since it isn't constrained by
 * WhatsApp's static-image-only delivery — this component renders real
 * <video>/<img> tags so gif and webm card art actually animate, which
 * the bot's PNG/WEBP export can never do.
 */

import { useState } from "react";
import Image from "next/image";
import type { CardFileExtension, CardRarity } from "../../lib/api";

const RARITY_RING: Record<string, string> = {
  UR: "rarity-ring-legendary",
  SSR: "rarity-ring-epic",
  SR: "rarity-ring-rare",
  R: "rarity-ring-uncommon",
  C: "rarity-ring-common",
};

export interface ShowcaseSlotCard {
  instanceId: string;
  mediaUrl: string;
  fileExtension: CardFileExtension;
  rarity: CardRarity;
}

function ShowcaseCardArt({ card }: { card: ShowcaseSlotCard }) {
  const [broken, setBroken] = useState(false);
  const isVideo = card.fileExtension === "webm";

  if (broken) {
    return (
      <div className="flex h-full w-full items-center justify-center text-2xl opacity-40">
        🃏
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        src={card.mediaUrl}
        className="h-full w-full object-contain"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        onError={() => setBroken(true)}
      />
    );
  }
  // Plain <img>, not next/image — gif animation needs to survive.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={card.mediaUrl}
      alt=""
      className="h-full w-full object-contain"
      onError={() => setBroken(true)}
    />
  );
}

export function DeckShowcase({
  deckName,
  backgroundUrl,
  slots,
  onSlotTap,
  interactive = false,
}: {
  deckName: string;
  backgroundUrl: string | null;
  /** Exactly 12 entries, null for empty slots, in slot order. */
  slots: (ShowcaseSlotCard | null)[];
  onSlotTap?: (position: number) => void;
  interactive?: boolean;
}) {
  const filledCount = slots.filter(Boolean).length;
  const padded = Array.from({ length: 12 }, (_, i) => slots[i] ?? null);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[rgba(200,168,75,0.20)]">
      {/* Background layer */}
      <div className="absolute inset-0">
        {backgroundUrl ? (
          <Image
            src={backgroundUrl}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[rgba(200,168,75,0.12)] to-black" />
        )}
        {/* Flat darken, mirrors DeckCard.ts's tintAndTextSvg */}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Header */}
      <div className="relative flex flex-col items-center gap-1 pt-5 text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          Ayakashi Deck
        </span>
        <span className="font-display px-4 text-xl font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] sm:text-2xl">
          {deckName}
        </span>
      </div>

      {/* Grid */}
      <div className="relative grid grid-cols-4 gap-2 p-4 sm:gap-3 sm:p-6">
        {padded.map((card, pos) => (
          <button
            key={pos}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onSlotTap?.(pos)}
            className={`relative aspect-[3/4] w-full overflow-hidden rounded-md transition-all ${
              card
                ? `${RARITY_RING[card.rarity]} bg-black/40`
                : "border border-dashed border-white/20 bg-white/5"
            } ${interactive ? "hover:-translate-y-0.5 active:scale-95" : ""}`}
          >
            {card ? <ShowcaseCardArt card={card} /> : null}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="relative flex flex-col items-center gap-0.5 pb-5 text-center">
        <span className="text-sm font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          {filledCount} / 12 cards
        </span>
        <span className="text-[10px] text-white/70 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          Ayakashi Community
        </span>
      </div>
    </div>
  );
}
