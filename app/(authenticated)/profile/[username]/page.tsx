"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Heart, Lock, ArrowLeft } from "lucide-react";
import {
  getProfile,
  likeProfile,
  ApiResponseError,
} from "../../../../lib/api";
import type { ProfileResponse, ProfileCardItem, DeckSlot } from "../../../../lib/api";
import { AvatarWithFrame } from "../../../components/AvatarWithFrame";

// ── helpers ───────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-US");
}

const RARITY_COLORS: Record<string, string> = {
  UR:  "text-[#FFD700] border-[#FFD700]/40",
  SSR: "text-purple-400 border-purple-400/40",
  SR:  "text-blue-400 border-blue-400/40",
  R:   "text-green-400 border-green-400/40",
  C:   "text-[rgba(200,168,75,0.50)] border-[rgba(200,168,75,0.20)]",
};

// ── XP bar ────────────────────────────────────────────────────────
function XpBar({ xp, level }: { xp: number; level: number }) {
  const xpPerLevel = 1000;
  const currentXp = xp % xpPerLevel;
  const pct = Math.min(100, (currentXp / xpPerLevel) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
        <span>Lv {level}</span>
        <span>{fmt(currentXp)} / {fmt(xpPerLevel)} XP</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden bg-[rgba(200,168,75,0.10)]">
        <div className="h-full bg-[#c8a84b] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Card thumb ────────────────────────────────────────────────────
function CardThumb({ item }: { item: ProfileCardItem }) {
  const rarity = item.card?.rarity ?? "C";
  return (
    <div className={`relative overflow-hidden border ${RARITY_COLORS[rarity] ?? "border-[rgba(200,168,75,0.20)]"} bg-[rgba(200,168,75,0.03)]`}>
      {item.card?.mediaUrl ? (
        <Image
          src={item.card.mediaUrl}
          alt={item.card.name}
          width={120}
          height={160}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-36 items-center justify-center text-3xl">🃏</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1">
        <p className="truncate text-[9px] font-bold leading-tight text-[#f0e6c8]">
          {item.card?.name ?? "Unknown"}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`text-[8px] font-bold uppercase ${RARITY_COLORS[rarity]?.split(" ")[0] ?? ""}`}>
            {rarity}
          </span>
          {item.isLocked && <Lock className="h-2.5 w-2.5 text-[rgba(200,168,75,0.50)]" />}
        </div>
      </div>
    </div>
  );
}

// ── Deck slot card ────────────────────────────────────────────────
function DeckSlotCard({ slot }: { slot: DeckSlot }) {
  if (slot.state === "locked") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-[rgba(200,168,75,0.15)] p-4 text-center opacity-40">
        <Lock className="h-5 w-5 text-[rgba(200,168,75,0.40)]" />
        <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">Locked</span>
      </div>
    );
  }
  if (slot.state === "empty") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-[rgba(200,168,75,0.20)] p-4 text-center opacity-50">
        <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">Empty Deck</span>
      </div>
    );
  }
  return (
    <div className="form-card flex flex-col gap-2 border p-3">
      {slot.backgroundUrl && (
        <div className="relative h-16 w-full overflow-hidden">
          <Image src={slot.backgroundUrl} alt="deck bg" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}
      <p className="truncate text-xs font-bold text-[#f0e6c8]">{slot.deckName ?? `Deck ${slot.slotIndex + 1}`}</p>
      <div className="flex items-center gap-1 flex-wrap">
        {Array.from({ length: 12 }).map((_, i) => {
          const filled = slot.slots ? slot.slots[i] !== null : false;
          return (
            <div
              key={i}
              className={`h-3 w-2 border ${filled ? "border-[#c8a84b] bg-[rgba(200,168,75,0.30)]" : "border-[rgba(200,168,75,0.15)] bg-transparent"}`}
            />
          );
        })}
      </div>
      <span className="text-[10px] text-[rgba(200,168,75,0.40)]">
        {slot.filledSlotCount ?? 0} / 12 cards
      </span>
    </div>
  );
}

// ── Sort options ──────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: "newest" as const, label: "Newest" },
  { id: "rarity" as const, label: "Rarity" },
  { id: "name" as const,   label: "Name" },
];

// ── Main page ──────────────────────────────────────────────────────
export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = Array.isArray(params.username)
    ? params.username[0]
    : (params.username as string);

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cardsPage, setCardsPage] = useState(1);
  const [cardsSort, setCardsSort] = useState<"newest" | "rarity" | "name">("newest");
  const [cardsLoading, setCardsLoading] = useState(false);

  const [likeLoading, setLikeLoading] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);

  const load = useCallback(async (page = 1, sort: "newest" | "rarity" | "name" = "newest") => {
    if (page === 1 && sort === "newest") setLoading(true);
    else setCardsLoading(true);
    setError("");
    try {
      const res = await getProfile(username, { cardsPage: page, cardsSort: sort });
      setData(res);
      setLikeCount(res.identity.likeCount);
      setLiked(res.identity.isLikedByViewer);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      if (err instanceof ApiResponseError && err.status === 404) { setError("Player not found."); }
      else setError("Couldn't load profile. Try refreshing.");
    } finally {
      setLoading(false);
      setCardsLoading(false);
    }
  }, [username, router]);

  useEffect(() => { load(1, "newest"); }, [load]);

  const handleSortChange = (s: "newest" | "rarity" | "name") => {
    setCardsSort(s);
    setCardsPage(1);
    load(1, s);
  };

  const handlePageChange = (p: number) => {
    setCardsPage(p);
    load(p, cardsSort);
  };

  const handleLike = async () => {
    if (!data || data.identity.isOwnProfile || likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await likeProfile(username);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
    } catch {
      // noop
    } finally {
      setLikeLoading(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <svg className="h-8 w-8 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );

  if (error || !data) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="text-sm text-[rgba(200,168,75,0.60)]">{error || "Something went wrong."}</p>
      <button type="button" onClick={() => router.back()} className="brush-btn w-40">Go Back</button>
    </div>
  );

  const { identity, deck, cards, friends } = data;

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

      {/* ── Back button ── */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1.5 text-xs text-[rgba(200,168,75,0.50)] transition-colors hover:text-[#c8a84b]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* ── Banner ── */}
      {identity.bannerUrl && (
        <div className="relative h-32 w-full overflow-hidden border border-[rgba(200,168,75,0.20)] sm:h-48">
          <Image src={identity.bannerUrl} alt="banner" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0a]/80" />
        </div>
      )}

      {/* ── Identity header ── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
        {/* Avatar — always use AvatarWithFrame so the frame overlay renders
            correctly. When there's no frame, frameSrc falls back to the
            default frame asset (transparent / minimal). */}
        <div className="shrink-0">
          <AvatarWithFrame
            avatarSrc={identity.avatarUrl ?? "/user-profile/user-profile/default-avatar.webp"}
            frameSrc={identity.frameUrl ?? "/user-profile/user-profile/default-avatar-frame.webp"}
            innerSize={96}
          />
        </div>

        {/* Name + stats */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#f0e6c8]">{identity.displayName}</h1>
              <p className="text-xs text-[rgba(200,168,75,0.45)]">@{identity.username}</p>
            </div>
            {/* Like button (hidden on own profile) */}
            {!identity.isOwnProfile && (
              <button
                type="button"
                onClick={handleLike}
                disabled={likeLoading}
                className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
                  liked
                    ? "border-red-500/60 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-[rgba(200,168,75,0.30)] text-[rgba(200,168,75,0.60)] hover:border-red-500/60 hover:text-red-400"
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${liked ? "fill-red-400" : ""}`} />
                {fmt(likeCount)}
              </button>
            )}
            {identity.isOwnProfile && (
              <div className="flex items-center gap-2">
                <Link
                  href="/settings"
                  className="border border-[rgba(200,168,75,0.30)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b]"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/cosmetics"
                  className="border border-[rgba(200,168,75,0.20)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.45)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b]"
                  title="Change avatar, banner, frame"
                >
                  🎨
                </Link>
              </div>
            )}
          </div>

          <XpBar xp={identity.xp} level={identity.level} />

          {identity.bio && (
            <p className="text-sm leading-6 text-[#a89880]">{identity.bio}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
            {!identity.isOwnProfile && (
              <span>
                <Heart className="inline h-3 w-3 mr-0.5" />
                {fmt(likeCount)} likes
              </span>
            )}
            {!friends.hidden && (
              <span>👥 {friends.jids.length} friends</span>
            )}
            <span>📅 Joined {new Date(identity.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
          </div>
        </div>
      </div>

      <hr className="gold-rule" />

      {/* ── Decks ── */}
      <div>
        <div className="section-header mb-5">
          <span className="section-header-text">Decks</span>
        </div>
        {deck.slots.every(s => s.state === "locked") ? (
          <p className="text-sm text-[rgba(200,168,75,0.40)]">No decks yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {deck.slots
              .filter(s => !(s.state === "locked" && !identity.isOwnProfile))
              .map(slot => (
                <DeckSlotCard key={slot.slotIndex} slot={slot} />
              ))}
          </div>
        )}
        {identity.isOwnProfile && (
          <div className="mt-3">
            <Link
              href="/decks"
              className="text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)] transition-colors hover:text-[#c8a84b]"
            >
              Manage Decks →
            </Link>
          </div>
        )}
      </div>

      <hr className="gold-rule" />

      {/* ── Cards ── */}
      <div>
        <div className="section-header mb-5">
          <span className="section-header-text">Cards</span>
        </div>

        {cards.hidden ? (
          <p className="text-sm text-[rgba(200,168,75,0.40)]">This player has hidden their card collection.</p>
        ) : (
          <>
            {/* Sort + count header */}
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-[rgba(200,168,75,0.45)]">
                {fmt(cards.total)} card{cards.total !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-0 border border-[rgba(200,168,75,0.20)]">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSortChange(opt.id)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      cardsSort === opt.id
                        ? "bg-[rgba(200,168,75,0.15)] text-[#c8a84b]"
                        : "text-[rgba(200,168,75,0.40)] hover:text-[rgba(200,168,75,0.70)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {cardsLoading ? (
              <div className="flex h-40 items-center justify-center">
                <svg className="h-6 w-6 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
            ) : cards.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">No cards yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {cards.items.map(item => (
                  <CardThumb key={item.instanceId} item={item} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!cardsLoading && cards.totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={cardsPage <= 1}
                  onClick={() => handlePageChange(cardsPage - 1)}
                  className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="text-xs text-[rgba(200,168,75,0.40)]">
                  Page {cardsPage} / {cards.totalPages}
                </span>
                <button
                  type="button"
                  disabled={cardsPage >= cards.totalPages}
                  onClick={() => handlePageChange(cardsPage + 1)}
                  className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
