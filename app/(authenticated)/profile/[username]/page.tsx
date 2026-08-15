"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  use as usePromise,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  Lock,
  ArrowLeft,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Camera,
  Upload,
  X,
  Check,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getProfile,
  likeProfile,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  uploadCosmetic,
  getCosmeticUploads,
  equipCosmetic,
  ApiResponseError,
} from "../../../../lib/api";
import type {
  ProfileResponse,
  ProfileCardItem,
  DeckSlot,
  CosmeticUpload,
  FriendStatus,
} from "../../../../lib/api";
import { AvatarWithFrame } from "../../../components/AvatarWithFrame";
import { CardTile } from "../../../components/CardTile";

// ── helpers ───────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-US");
}

// ── XP bar ────────────────────────────────────────────────────────
function XpBar({ xp, level }: { xp: number; level: number }) {
  const xpPerLevel = 1000;
  const currentXp = xp % xpPerLevel;
  const pct = Math.min(100, (currentXp / xpPerLevel) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
        <span>Lv {level}</span>
        <span>
          {fmt(currentXp)} / {fmt(xpPerLevel)} XP
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(200,168,75,0.10)]">
        <div
          className="h-full rounded-full bg-ayakashi-gold shadow-[0_0_6px_rgba(200,168,75,0.5)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Friend button — all four states ─────────────────────────────────
function FriendButton({
  status,
  onAdd,
  onAccept,
  onDecline,
  onRemove,
  busy,
}: {
  status: FriendStatus;
  onAdd: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  if (status === "friends") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-green-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        <UserCheck className="h-3.5 w-3.5" /> Friends
      </button>
    );
  }
  if (status === "request_sent") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="flex items-center gap-1.5 rounded-md border border-[rgba(200,168,75,0.30)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
      >
        <Clock className="h-3.5 w-3.5" /> Pending
      </button>
    );
  }
  if (status === "request_received") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="flex items-center gap-1.5 rounded-md border border-ayakashi-gold bg-ayakashi-gold px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:brightness-110 disabled:opacity-50"
        >
          <UserCheck className="h-3.5 w-3.5" /> Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="flex items-center gap-1.5 rounded-md border border-[rgba(200,168,75,0.30)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)] transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
        >
          <UserX className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onAdd}
      className="flex items-center gap-1.5 rounded-md border border-ayakashi-gold px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:opacity-50"
    >
      <UserPlus className="h-3.5 w-3.5" /> Add Friend
    </button>
  );
}

// ── Deck slot card ────────────────────────────────────────────────
function DeckSlotCard({ slot }: { slot: DeckSlot }) {
  if (slot.state === "locked") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(200,168,75,0.15)] p-4 text-center opacity-40">
        <Lock className="h-5 w-5 text-[rgba(200,168,75,0.40)]" />
        <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
          Locked
        </span>
      </div>
    );
  }
  if (slot.state === "empty") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(200,168,75,0.20)] p-4 text-center opacity-50">
        <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
          Empty Deck
        </span>
      </div>
    );
  }
  return (
    <div className="craft-card flex flex-col gap-2 overflow-hidden rounded-xl p-3">
      {slot.backgroundUrl ? (
        <div className="relative -m-3 mb-0 h-20 w-[calc(100%+1.5rem)] overflow-hidden">
          <Image
            src={slot.backgroundUrl}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>
      ) : (
        <div className="-m-3 mb-0 flex h-20 w-[calc(100%+1.5rem)] items-center justify-center bg-[rgba(200,168,75,0.04)] text-2xl opacity-30">
          🃏
        </div>
      )}
      <p
        className={`truncate text-xs font-bold text-[#f0e6c8] ${slot.backgroundUrl ? "-mt-6 relative z-10" : ""}`}
      >
        {slot.deckName ?? `Deck ${slot.slotIndex + 1}`}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {Array.from({ length: 12 }).map((_, i) => {
          const filled = slot.slots ? slot.slots[i] !== null : false;
          return (
            <div
              key={i}
              className={`h-3 w-2 rounded-sm border ${filled ? "border-ayakashi-gold bg-ayakashi-gold/30" : "border-[rgba(200,168,75,0.15)] bg-transparent"}`}
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

// ── Tap-to-manage action sheet (avatar/banner, own profile only) ────
function CosmeticQuickSheet({
  slot,
  unlocked,
  banked,
  onClose,
  onDone,
}: {
  slot: "avatar" | "banner";
  unlocked: boolean;
  banked: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "switcher">("menu");
  const [uploads, setUploads] = useState<CosmeticUpload[]>([]);
  const [loadingSwitcher, setLoadingSwitcher] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const openSwitcher = async () => {
    setMode("switcher");
    setLoadingSwitcher(true);
    try {
      setUploads((await getCosmeticUploads(slot)).uploads);
    } catch {
      /* noop */
    } finally {
      setLoadingSwitcher(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setErr("");
    try {
      await uploadCosmetic(slot, file);
      onDone();
    } catch (err) {
      setErr(
        err instanceof ApiResponseError ? err.error.message : "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSwitch = async (u: CosmeticUpload) => {
    try {
      await equipCosmetic({ slot, uploadId: u.id });
      onDone();
    } catch (err) {
      setErr(err instanceof ApiResponseError ? err.error.message : "Failed.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="craft-modal-pop form-card w-full max-w-sm rounded-t-2xl border p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
            {slot === "avatar" ? "Avatar" : "Banner"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[rgba(200,168,75,0.45)] hover:text-ayakashi-gold"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {err && (
          <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {err}
          </p>
        )}

        {mode === "menu" ? (
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-ayakashi-gold text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />{" "}
              {uploading ? "Uploading…" : "Upload New"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFile}
            />

            {banked && (
              <button
                type="button"
                onClick={openSwitcher}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-[rgba(200,168,75,0.30)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold"
              >
                <Sparkles className="h-4 w-4" /> Switch Animated
              </button>
            )}

            <p className="mt-1 text-center text-[10px] leading-relaxed text-[rgba(200,168,75,0.40)]">
              Static uploads are free. Animated requires owning {slot}_pass —{" "}
              {unlocked ? (
                <span className="font-bold text-green-400">unlocked ✓</span>
              ) : (
                <span className="font-bold text-[rgba(200,168,75,0.55)]">
                  not unlocked yet
                </span>
              )}
              .{" "}
              <Link
                href="/cosmetics"
                className="text-ayakashi-gold hover:brightness-125"
                onClick={onClose}
              >
                Full manager →
              </Link>
            </p>
          </div>
        ) : loadingSwitcher ? (
          <div className="flex h-24 items-center justify-center">
            <svg
              className="h-5 w-5 animate-spin text-ayakashi-gold"
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
        ) : uploads.length === 0 ? (
          <p className="py-8 text-center text-xs text-[rgba(200,168,75,0.40)]">
            No animated uploads banked yet.
          </p>
        ) : (
          <div
            className={`grid gap-2 ${slot === "banner" ? "grid-cols-2" : "grid-cols-3"}`}
          >
            {uploads.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSwitch(u)}
                className={`overflow-hidden rounded-md border ${u.isEquipped ? "border-ayakashi-gold ring-1 ring-ayakashi-gold/40" : "border-[rgba(200,168,75,0.20)]"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.url}
                  alt=""
                  className={`w-full object-cover ${slot === "banner" ? "h-14" : "h-16"}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pending friend request row ───────────────────────────────────────
function PendingRequestRow({
  requester,
  onAccept,
  onDecline,
  busy,
}: {
  requester: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(200,168,75,0.15)] bg-white/[0.02] p-3">
      <Link
        href={`/profile/${requester.username}`}
        className="flex min-w-0 items-center gap-3"
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[rgba(200,168,75,0.1)]">
          {requester.avatarUrl ? (
            <Image
              src={requester.avatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[rgba(200,168,75,0.5)]">
              {requester.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#f0e6c8]">
            {requester.displayName}
          </p>
          <p className="truncate text-xs text-[rgba(200,168,75,0.40)]">
            @{requester.username}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="flex h-8 items-center gap-1 rounded-md border border-ayakashi-gold bg-ayakashi-gold px-2.5 text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:brightness-110 disabled:opacity-50"
        >
          <Check className="h-3 w-3" /> Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="flex h-8 items-center justify-center rounded-md border border-red-500/40 px-2.5 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Sort options ──────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: "newest" as const, label: "Newest" },
  { id: "rarity" as const, label: "Rarity" },
  { id: "name" as const, label: "Name" },
];

// ── Tab config — extend this array to add Achievements/Guild later ──
type TabId = "decks" | "cards" | "friends";
const TABS: { id: TabId; label: string }[] = [
  { id: "decks", label: "Decks" },
  { id: "cards", label: "Cards" },
  { id: "friends", label: "Friends" },
];

// ── Main page ──────────────────────────────────────────────────────
export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = usePromise(params);
  const router = useRouter();

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cardsPage, setCardsPage] = useState(1);
  const [cardsSort, setCardsSort] = useState<"newest" | "rarity" | "name">(
    "newest",
  );
  const [cardsLoading, setCardsLoading] = useState(false);

  const [likeLoading, setLikeLoading] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);

  const [friendStatus, setFriendStatus] = useState<FriendStatus>("none");
  const [friendBusy, setFriendBusy] = useState(false);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);

  const [quickSheet, setQuickSheet] = useState<"avatar" | "banner" | null>(
    null,
  );

  // ── swipeable tabs ──
  const [activeTab, setActiveTab] = useState<TabId>("decks");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const load = useCallback(
    async (page = 1, sort: "newest" | "rarity" | "name" = "newest") => {
      if (page === 1 && sort === "newest") setLoading(true);
      else setCardsLoading(true);
      setError("");
      try {
        const res = await getProfile(username, {
          cardsPage: page,
          cardsSort: sort,
        });
        setData(res);
        setLikeCount(res.identity.likeCount);
        setLiked(res.identity.isLikedByViewer);
        setFriendStatus(res.identity.friendStatus);
      } catch (err) {
        if (err instanceof ApiResponseError && err.status === 401) {
          router.push("/login");
          return;
        }
        if (err instanceof ApiResponseError && err.status === 404)
          setError("Player not found.");
        else setError("Couldn't load profile. Try refreshing.");
      } finally {
        setLoading(false);
        setCardsLoading(false);
      }
    },
    [username, router],
  );

  useEffect(() => {
    load(1, "newest");
  }, [load]);

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
      /* noop */
    } finally {
      setLikeLoading(false);
    }
  };

  const handleFriendAction = async (
    action: "add" | "accept" | "decline" | "remove",
  ) => {
    setFriendBusy(true);
    try {
      if (action === "add")
        setFriendStatus((await sendFriendRequest(username)).friendStatus);
      else if (action === "accept")
        setFriendStatus((await acceptFriendRequest(username)).friendStatus);
      else setFriendStatus((await removeFriend(username)).friendStatus); // covers both remove & decline
    } catch {
      /* noop */
    } finally {
      setFriendBusy(false);
    }
  };

  const handlePendingAction = async (
    requesterUsername: string,
    action: "accept" | "decline",
  ) => {
    setPendingBusy(requesterUsername);
    try {
      if (action === "accept") await acceptFriendRequest(requesterUsername);
      else await removeFriend(requesterUsername); // decline == remove, per backend
      await load(cardsPage, cardsSort); // refresh pendingReceived + friends list
    } catch {
      /* noop */
    } finally {
      setPendingBusy(null);
    }
  };

  // ── tab <-> scroll sync ──
  const scrollToTab = (tabId: TabId) => {
    const idx = TABS.findIndex((t) => t.id === tabId);
    const el = scrollerRef.current;
    if (!el) return;
    isProgrammaticScroll.current = true;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    setActiveTab(tabId);
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 400);
  };

  const handleScroll = () => {
    if (isProgrammaticScroll.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const tab = TABS[idx];
    if (tab && tab.id !== activeTab) setActiveTab(tab.id);
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
          {error || "Something went wrong."}
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="brush-btn w-40"
        >
          Go Back
        </button>
      </div>
    );

  const { identity, deck, cards, friends } = data;
  const pendingCount =
    (!friends.hidden && friends.pendingReceived?.length) || 0;

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8">
      {/* ── Hero: overlapping banner + avatar ── */}
      <div className="relative">
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-[#f0e6c8] backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <button
          type="button"
          disabled={!identity.isOwnProfile}
          onClick={() => identity.isOwnProfile && setQuickSheet("banner")}
          className={`relative block h-40 w-full overflow-hidden bg-gradient-to-br from-[rgba(200,168,75,0.15)] to-black sm:h-56 ${identity.isOwnProfile ? "group cursor-pointer" : "cursor-default"}`}
        >
          {identity.bannerUrl && (
            <Image
              src={identity.bannerUrl}
              alt="banner"
              fill
              className="object-cover"
              unoptimized
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/10 to-black/30" />
          {identity.isOwnProfile && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
              <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-ayakashi-gold">
                <Camera className="h-3.5 w-3.5" /> Change Banner
              </span>
            </div>
          )}
        </button>

        <div className="absolute -bottom-12 left-4 z-10 sm:-bottom-14 sm:left-6">
          <button
            type="button"
            disabled={!identity.isOwnProfile}
            onClick={() => identity.isOwnProfile && setQuickSheet("avatar")}
            className={`group relative block rounded-full ring-4 ring-[#0a0a0a] ${identity.isOwnProfile ? "cursor-pointer" : "cursor-default"}`}
          >
            <AvatarWithFrame
              avatarSrc={
                identity.avatarUrl ??
                "/user-profile/user-profile/default-avatar.webp"
              }
              frameSrc={
                identity.frameUrl ??
                "/user-profile/user-profile/default-avatar-frame.webp"
              }
              innerSize={104}
            />
            {identity.isOwnProfile && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                <Camera className="h-5 w-5 text-ayakashi-gold" />
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 sm:px-6 lg:px-8">
        {/* ── Identity header ── */}
        <div className="flex flex-col gap-3 pt-14 sm:pt-2 sm:pl-[124px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#f0e6c8]">
                {identity.displayName}
              </h1>
              <p className="text-xs text-[rgba(200,168,75,0.45)]">
                @{identity.username}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!identity.isOwnProfile && (
                <>
                  <button
                    type="button"
                    onClick={handleLike}
                    disabled={likeLoading}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
                      liked
                        ? "border-red-500/60 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "border-[rgba(200,168,75,0.30)] text-[rgba(200,168,75,0.60)] hover:border-red-500/60 hover:text-red-400"
                    }`}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${liked ? "fill-red-400" : ""}`}
                    />
                    {fmt(likeCount)}
                  </button>
                  <FriendButton
                    status={friendStatus}
                    busy={friendBusy}
                    onAdd={() => handleFriendAction("add")}
                    onAccept={() => handleFriendAction("accept")}
                    onDecline={() => handleFriendAction("decline")}
                    onRemove={() => handleFriendAction("remove")}
                  />
                </>
              )}
              {identity.isOwnProfile && (
                <>
                  {/* Own-profile like count IS shown — read-only, since
                      the like button itself is meaningless on your own
                      profile (can't self-like), but the count is still
                      relevant information about you. */}
                  <span className="flex items-center gap-1.5 rounded-md border border-[rgba(200,168,75,0.20)] px-3 py-1.5 text-xs font-bold text-[rgba(200,168,75,0.55)]">
                    <Heart className="h-3.5 w-3.5" /> {fmt(likeCount)}
                  </span>
                  <Link
                    href="/settings"
                    className="rounded-md border border-[rgba(200,168,75,0.30)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold"
                  >
                    Edit Profile
                  </Link>
                </>
              )}
            </div>
          </div>

          <XpBar xp={identity.xp} level={identity.level} />

          {identity.bio && (
            <p className="text-sm leading-6 text-[#a89880]">{identity.bio}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
            {!friends.hidden && (
              <span>👥 {friends.friends.length} friends</span>
            )}
            <span>
              📅 Joined{" "}
              {new Date(identity.joinedAt).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <hr className="gold-rule" />

        {/* ── Tab bar ── */}
        <div className="flex gap-0 border-b border-[rgba(200,168,75,0.15)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => scrollToTab(t.id)}
              className={`relative flex-1 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                activeTab === t.id
                  ? "text-ayakashi-gold"
                  : "text-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.70)]"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {t.label}
                {t.id === "friends" && pendingCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </span>
              {activeTab === t.id && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-ayakashi-gold shadow-[0_0_8px_rgba(200,168,75,0.6)]" />
              )}
            </button>
          ))}
        </div>

        {/* ── Swipeable panels ── */}
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
          style={{ scrollBehavior: "smooth" }}
        >
          {/* Decks panel */}
          <div className="w-full shrink-0 snap-start px-0.5">
            {deck.slots.every((s) => s.state === "locked") ? (
              <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
                No decks yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {deck.slots
                  .filter(
                    (s) => !(s.state === "locked" && !identity.isOwnProfile),
                  )
                  .map((slot) => (
                    <DeckSlotCard key={slot.slotIndex} slot={slot} />
                  ))}
              </div>
            )}
            {identity.isOwnProfile && (
              <Link
                href="/decks"
                className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)] transition-colors hover:text-ayakashi-gold"
              >
                Manage Decks →
              </Link>
            )}
          </div>

          {/* Cards panel */}
          <div className="w-full shrink-0 snap-start px-0.5">
            {cards.hidden ? (
              <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
                This player has hidden their card collection.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[rgba(200,168,75,0.45)]">
                    {fmt(cards.totalCount)} card
                    {cards.totalCount !== 1 ? "s" : ""}
                  </span>
                  <div className="flex gap-0 overflow-hidden rounded-md border border-[rgba(200,168,75,0.20)]">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSortChange(opt.id)}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                          cardsSort === opt.id
                            ? "bg-ayakashi-gold/15 text-ayakashi-gold"
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
                    <svg
                      className="h-6 w-6 animate-spin text-ayakashi-gold"
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
                ) : cards.results.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
                    No cards yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {cards.results.map((item) => (
                      <CardTile
                        key={item.instanceId}
                        card={{
                          shortId: item.shortId,
                          name: item.name,
                          seriesName: item.seriesName ?? "",
                          rarity: item.rarity,
                          isEvent: item.isEvent,
                          eventName: item.eventName,
                          thumbUrl: item.thumbUrl,
                          mediaType: item.mediaType,
                          fileExtension: item.fileExtension,
                          ownerCount: item.ownerCount,
                          wishlistCount: item.wishlistCount,
                          totalIssued: item.totalIssued,
                        }}
                      />
                    ))}
                  </div>
                )}

                {!cardsLoading && cards.totalPages > 1 && (
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={cardsPage <= 1}
                      onClick={() => handlePageChange(cardsPage - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(200,168,75,0.30)] text-[rgba(200,168,75,0.65)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1.5 text-xs text-[rgba(200,168,75,0.55)]">
                      <input
                        type="number"
                        min={1}
                        max={cards.totalPages}
                        value={cardsPage}
                        onChange={(e) => {
                          const p = Math.min(
                            cards.totalPages,
                            Math.max(1, Number(e.target.value) || 1),
                          );
                          handlePageChange(p);
                        }}
                        className="form-input h-8 w-14 border px-1.5 text-center text-xs outline-none"
                      />
                      <span>/ {cards.totalPages}</span>
                    </div>
                    <button
                      type="button"
                      disabled={cardsPage >= cards.totalPages}
                      onClick={() => handlePageChange(cardsPage + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(200,168,75,0.30)] text-[rgba(200,168,75,0.65)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Friends panel */}
          <div className="w-full shrink-0 snap-start px-0.5">
            {friends.hidden ? (
              <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
                This player has hidden their friends list.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {identity.isOwnProfile &&
                  friends.pendingReceived &&
                  friends.pendingReceived.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                        Requests ({friends.pendingReceived.length})
                      </p>
                      {friends.pendingReceived.map((r) => (
                        <PendingRequestRow
                          key={r.username}
                          requester={r}
                          busy={pendingBusy === r.username}
                          onAccept={() =>
                            handlePendingAction(r.username, "accept")
                          }
                          onDecline={() =>
                            handlePendingAction(r.username, "decline")
                          }
                        />
                      ))}
                    </div>
                  )}

                <div className="flex flex-col gap-2">
                  {friends.friends.length > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                      Friends ({friends.friends.length})
                    </p>
                  )}
                  {friends.friends.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[rgba(200,168,75,0.40)]">
                      No friends yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {friends.friends.map((f) => (
                        <Link
                          key={f.username}
                          href={`/profile/${f.username}`}
                          className="flex items-center gap-3 rounded-lg border border-[rgba(200,168,75,0.15)] bg-white/[0.02] p-3 transition-colors hover:border-ayakashi-gold/40"
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[rgba(200,168,75,0.1)]">
                            {f.avatarUrl ? (
                              <Image
                                src={f.avatarUrl}
                                alt=""
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[rgba(200,168,75,0.5)]">
                                {f.displayName.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#f0e6c8]">
                              {f.displayName}
                            </p>
                            <p className="truncate text-xs text-[rgba(200,168,75,0.40)]">
                              @{f.username}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {quickSheet && identity.isOwnProfile && (
        <CosmeticQuickSheet
          slot={quickSheet}
          unlocked={Boolean(
            (quickSheet === "avatar"
              ? identity.avatarPassCount
              : identity.bannerPassCount) ?? 0,
          )}
          banked={Boolean(
            quickSheet === "avatar"
              ? identity.avatarBanked
              : identity.bannerBanked,
          )}
          onClose={() => setQuickSheet(null)}
          onDone={() => {
            setQuickSheet(null);
            load(cardsPage, cardsSort);
          }}
        />
      )}
    </section>
  );
}
