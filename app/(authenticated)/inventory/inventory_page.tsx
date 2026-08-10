"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getInventory, ApiResponseError } from "../../../lib/api";
import type {
  InventoryItem,
  ItemCategory,
  InventoryCosmetics,
} from "../../../lib/api";
import { CurrencyIcon } from "../../components/CurrencyIcon";

// ── Item art — image with emoji fallback (matches craft/upgrade) ────
function ItemArt({
  src,
  emoji,
  alt,
  size = 48,
}: {
  src?: string;
  emoji: string;
  alt: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-lg bg-black/40 shadow-[0_0_0_1px_rgba(200,168,75,0.20)]"
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="object-contain p-1"
          unoptimized
          onError={() => setBroken(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.45 }}>{emoji}</span>
      )}
    </div>
  );
}

// ── Category tab config ────────────────────────────────────────────
const CATEGORY_TABS: { id: ItemCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "material", label: "Materials" },
  { id: "rob_gear", label: "Rob Gear" },
  { id: "consumable", label: "Consumables" },
  { id: "vault_upgrade", label: "Upgrades" },
  { id: "tool", label: "Tools" },
];

const RARITY_COLOR: Record<string, string> = {
  common: "text-[rgba(200,168,75,0.40)]",
  uncommon: "text-green-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-[#e6c96a]",
};

const RARITY_RING: Record<string, string> = {
  common: "rarity-ring-common",
  uncommon: "rarity-ring-uncommon",
  rare: "rarity-ring-rare",
  epic: "rarity-ring-epic",
  legendary: "rarity-ring-legendary",
};

// ── Durability label ───────────────────────────────────────────────
function durabilityLabel(item: InventoryItem): string | null {
  if (!item.durability) return null;
  const map: Record<string, string> = {
    permanent: "Permanent",
    "single-use": "Single Use",
    "shatter-on-fail": "Shatters on Fail",
    charges: item.maxCharges ? `${item.maxCharges} Charges` : "Charges",
  };
  return map[item.durability] ?? item.durability;
}

// ── Single item card ───────────────────────────────────────────────
function ItemCard({ item }: { item: InventoryItem }) {
  const dur = durabilityLabel(item);
  const ringClass = item.rarity ? RARITY_RING[item.rarity] : "";

  return (
    <div className="craft-card flex flex-col gap-3 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg ${ringClass}`}>
          <ItemArt
            src={`/items/${item.itemId}.webp`}
            emoji={item.emoji}
            alt={item.name}
            size={48}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display truncate text-sm font-bold leading-tight text-[#f0e6c8]">
            {item.name}
          </span>
          {item.rarity && (
            <span
              className={`text-[10px] font-bold uppercase tracking-widest ${RARITY_COLOR[item.rarity] ?? ""}`}
            >
              {item.rarity}
            </span>
          )}
        </div>
        <span className="shrink-0 rounded-md border border-[rgba(200,168,75,0.30)] bg-[rgba(200,168,75,0.08)] px-2.5 py-1 text-sm font-bold tabular-nums text-[#e6c96a]">
          ×{item.quantity}
        </span>
      </div>

      {item.flavor && (
        <p className="line-clamp-2 text-[11px] italic leading-5 text-[rgba(200,168,75,0.42)]">
          {item.flavor}
        </p>
      )}

      {(dur || item.toolLevel != null) && (
        <div className="flex flex-wrap items-center gap-2">
          {dur && (
            <span className="rounded border border-[rgba(200,168,75,0.22)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
              {dur}
            </span>
          )}
          {item.toolLevel != null && (
            <span className="rounded border border-blue-500/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-blue-400">
              Lvl {item.toolLevel}
            </span>
          )}
        </div>
      )}

      {item.toolLevel != null && item.nextLevelCost && (
        <div className="flex items-center justify-between rounded-md border border-[rgba(200,168,75,0.12)] bg-white/[0.02] px-2.5 py-1.5 text-[10px]">
          <span className="uppercase tracking-wider text-[rgba(200,168,75,0.40)]">
            Next level
          </span>
          <span className="flex items-center gap-1 font-bold text-[rgba(200,168,75,0.65)]">
            <CurrencyIcon type="ryo" size={11} />{" "}
            {item.nextLevelCost.ryo.toLocaleString()} +{" "}
            {item.nextLevelCost.materialQty}×mat
          </span>
        </div>
      )}
    </div>
  );
}

// ── Cosmetics showcase (read-only preview, deep-links to /cosmetics) ─
function CosmeticShowcase({ cosmetics }: { cosmetics: InventoryCosmetics }) {
  const equippedAvatar = cosmetics.avatars.find((a) => a.isEquipped);
  const equippedBanner = cosmetics.banners.find((b) => b.isEquipped);
  const equippedFrame = cosmetics.frames.find((f) => f.isEquipped);
  const totalDeckBgs = cosmetics.deckBackgrounds.reduce(
    (n, g) => n + g.uploads.length,
    0,
  );

  const hasAnything =
    cosmetics.frames.length > 0 ||
    cosmetics.avatars.length > 0 ||
    cosmetics.banners.length > 0 ||
    totalDeckBgs > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
          {hasAnything ? "Your equipped cosmetics" : "No cosmetics yet"}
        </p>
        <Link
          href="/cosmetics"
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-ayakashi-gold hover:brightness-125"
        >
          Manage <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {!hasAnything ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-4xl opacity-30">🎭</span>
          <p className="text-sm text-[rgba(200,168,75,0.40)]">
            You haven't equipped any cosmetics.
          </p>
          <Link href="/cosmetics" className="brush-btn w-48">
            Go to Cosmetics
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Avatar */}
          <div className="craft-card flex items-center gap-4 rounded-xl p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[rgba(200,168,75,0.25)] bg-black/40">
              {equippedAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={equippedAvatar.url}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl opacity-30">
                  👤
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
                Avatar
              </p>
              <p className="text-[11px] text-[rgba(200,168,75,0.45)]">
                {equippedAvatar
                  ? equippedAvatar.kind === "animated"
                    ? "Animated"
                    : "Static"
                  : "Not set"}
              </p>
            </div>
          </div>

          {/* Banner */}
          <div className="craft-card flex flex-col gap-2 rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
              Banner
            </p>
            <div className="h-14 w-full overflow-hidden rounded-md border border-[rgba(200,168,75,0.20)] bg-black/40">
              {equippedBanner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={equippedBanner.url}
                  alt="Banner"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] text-[rgba(200,168,75,0.35)]">
                  Not set
                </div>
              )}
            </div>
          </div>

          {/* Frame */}
          <div className="craft-card flex items-center gap-4 rounded-xl p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[rgba(200,168,75,0.25)] bg-black/40">
              {equippedFrame ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={equippedFrame.frameUrl}
                  alt={equippedFrame.name}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <span className="text-2xl opacity-30">🖼️</span>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
                Frame
              </p>
              <p className="text-[11px] text-[rgba(200,168,75,0.45)]">
                {equippedFrame?.name ?? "None equipped"}
              </p>
            </div>
          </div>

          {/* Deck backgrounds summary */}
          <div className="craft-card flex items-center gap-4 rounded-xl p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[rgba(200,168,75,0.25)] bg-black/40 text-2xl">
              🃏
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
                Deck Backgrounds
              </p>
              <p className="text-[11px] text-[rgba(200,168,75,0.45)]">
                {totalDeckBgs} uploaded across{" "}
                {cosmetics.deckBackgrounds.length} deck
                {cosmetics.deckBackgrounds.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function Inventory() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [cosmetics, setCosmetics] = useState<InventoryCosmetics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    ItemCategory | "all" | "cosmetics"
  >("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getInventory();
      setItems(res.items);
      setCosmetics(res.cosmetics);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError("Couldn't load your inventory. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const presentCategories = new Set(items.map((i) => i.category));
  const visibleTabs = CATEGORY_TABS.filter(
    (t) => t.id === "all" || presentCategories.has(t.id as ItemCategory),
  );

  const filtered =
    activeTab === "all" || activeTab === "cosmetics"
      ? items
      : items.filter((i) => i.category === activeTab);

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

  if (error)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="theme-body text-sm">{error}</p>
        <button type="button" onClick={load} className="brush-btn w-40">
          Retry
        </button>
      </div>
    );

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="section-header">
        <span className="section-header-text">Inventory</span>
      </div>

      <hr className="gold-rule" />

      {/* ── Top-level tabs (items vs cosmetics) ── */}
      <div className="flex gap-0 overflow-x-auto border-b border-[rgba(200,168,75,0.15)] scrollbar-none">
        {[...visibleTabs, { id: "cosmetics" as const, label: "Cosmetics" }].map(
          (t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`relative shrink-0 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                activeTab === t.id
                  ? "text-ayakashi-gold"
                  : "text-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.70)]"
              }`}
            >
              {t.label}
              {activeTab === t.id && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-ayakashi-gold shadow-[0_0_8px_rgba(200,168,75,0.6)]" />
              )}
            </button>
          ),
        )}
      </div>

      {activeTab === "cosmetics" ? (
        cosmetics && <CosmeticShowcase cosmetics={cosmetics} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-4xl opacity-30">🎒</span>
          <p className="text-sm text-[rgba(200,168,75,0.40)]">
            Your inventory is empty.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[11px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <ItemCard key={item.itemId} item={item} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
