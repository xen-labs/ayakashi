"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Check, AlertCircle, Info } from "lucide-react";
import {
  getCosmeticUploads,
  uploadCosmetic,
  equipCosmetic,
  deleteCosmeticUpload,
  getInventory,
  ApiResponseError,
} from "../../../lib/api";
import type {
  CosmeticSlot,
  CosmeticUpload,
  OwnedFrameItem,
} from "../../../lib/api";
import { FireSpinner } from "../../components/FireSpinner";

// ── constants matching the backend ───────────────────────────────
// cosmeticUpload.ts: MAX_FILE_BYTES = 32MB, ALLOWED_MIMETYPES = png/jpeg/webp/gif
// Animated (pages > 1 per sharp) requires owning avatar_pass or
// banner_pass — a ONE-TIME PURCHASE (see shopCatalog.ts's
// ONE_OF_A_KIND_ITEM_IDS) that permanently unlocks animated uploads
// for that slot, not a per-upload consumable credit.
// Static (single frame) is always free.
//
// [CHANGED] Banking model is now fixed at exactly one static slot +
// one animated slot per cosmetic type (avatar/banner) — not a scrollable
// upload history. Uploading a new file of either kind REPLACES whatever
// was banked for that kind; the OTHER kind's banked upload is left
// alone, which is what lets a player toggle between "my static" and
// "my animated" without re-uploading either. See cosmeticUpload.ts's
// header for the matching backend change.
const MAX_MB = 32;
const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";
const DECK_SLOT_COUNT = 5;

// ── pass info per slot ────────────────────────────────────────────
const PASS_INFO: Record<
  "avatar" | "banner",
  { itemId: string; label: string }
> = {
  avatar: { itemId: "avatar_pass", label: "avatar_pass" },
  banner: { itemId: "banner_pass", label: "banner_pass" },
};

const TOP_TABS = [
  { id: "avatar", label: "Avatar" },
  { id: "banner", label: "Banner" },
  { id: "frame", label: "Frame" },
  { id: "decks", label: "Deck BGs" },
] as const;
type TopTab = (typeof TOP_TABS)[number]["id"];

// ── Rules pill ────────────────────────────────────────────────────
function RulesPill({
  passItem,
  unlocked,
}: {
  passItem?: string;
  unlocked?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md border border-[rgba(200,168,75,0.15)] bg-[rgba(200,168,75,0.04)] px-3 py-2.5 text-[10px] leading-5 text-[rgba(200,168,75,0.55)]">
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-[rgba(200,168,75,0.40)]" />
      <span>
        <span className="font-bold text-[rgba(200,168,75,0.70)]">Static</span>{" "}
        PNG · JPEG · WEBP — free, no limit on swaps.
        {passItem && (
          <>
            {" "}
            <span className="font-bold text-purple-400">Animated</span> GIF ·
            animated WEBP — requires owning{" "}
            <code className="rounded bg-purple-500/10 px-1 text-purple-300">
              {passItem}
            </code>{" "}
            (one-time purchase from the Shop, unlocks it permanently).
            {unlocked && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-sm bg-green-500/15 px-1.5 py-0.5 font-bold text-green-400">
                <Check className="h-2.5 w-2.5" /> Unlocked
              </span>
            )}
          </>
        )}{" "}
        Max file size: {MAX_MB}MB.
      </span>
    </div>
  );
}

// ── Kind slot card — one fixed card for "static" or "animated" ──────
// Replaces the old scrollable upload-history grid: there are now at
// most two banked uploads per cosmetic slot (one static, one animated),
// so each gets its own fixed card instead of a variable-length list.
function KindSlotCard({
  kind,
  upload,
  aspectRatio,
  locked,
  lockedReason,
  uploading,
  onUploadClick,
  onEquip,
  onDelete,
}: {
  kind: "static" | "animated";
  upload: CosmeticUpload | null;
  aspectRatio: "square" | "banner";
  locked?: boolean;
  lockedReason?: string;
  uploading: boolean;
  onUploadClick: () => void;
  onEquip: () => void;
  onDelete: () => void;
}) {
  const h = aspectRatio === "banner" ? "h-20" : "h-24";
  const label = kind === "animated" ? "Animated" : "Static";

  return (
    <div
      className={`flex flex-col gap-2 rounded-md border p-2.5 ${
        upload?.isEquipped
          ? "border-ayakashi-gold ring-1 ring-ayakashi-gold/40"
          : "border-[rgba(200,168,75,0.20)]"
      } ${locked ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            kind === "animated"
              ? "text-purple-400"
              : "text-[rgba(200,168,75,0.55)]"
          }`}
        >
          {label}
        </span>
        {upload?.isEquipped && (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-ayakashi-gold">
            <Check className="h-2.5 w-2.5" /> Equipped
          </span>
        )}
      </div>

      <div
        className={`relative w-full ${h} overflow-hidden rounded-md bg-[rgba(200,168,75,0.04)]`}
      >
        {upload ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={upload.url}
            alt={label}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-[rgba(200,168,75,0.30)]">
            {locked ? (lockedReason ?? "Locked") : "Not set"}
          </div>
        )}
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={uploading || locked}
          onClick={onUploadClick}
          className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-[rgba(200,168,75,0.30)] text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.75)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? (
            <FireSpinner size={12} />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {upload ? "Replace" : "Upload"}
        </button>
        {upload && !upload.isEquipped && (
          <button
            type="button"
            onClick={onEquip}
            className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-ayakashi-gold text-[10px] font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black"
          >
            <Check className="h-3 w-3" /> Use
          </button>
        )}
        {upload && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${label.toLowerCase()}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-500/40 text-red-400 transition-colors hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Slot panel ────────────────────────────────────────────────────
function SlotPanel({
  slot,
  label,
  aspectRatio,
  slotIndex,
}: {
  slot: CosmeticSlot;
  label: string;
  aspectRatio: "square" | "banner";
  slotIndex?: number;
}) {
  const [uploads, setUploads] = useState<CosmeticUpload[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracked per-kind so uploading a static file doesn't disable the
  // animated card's button (and vice versa) while it's in flight.
  const [uploadingKind, setUploadingKind] = useState<
    "static" | "animated" | null
  >(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [passUnlocked, setPassUnlocked] = useState(false);
  const staticFileRef = useRef<HTMLInputElement>(null);
  const animatedFileRef = useRef<HTMLInputElement>(null);
  const passItem =
    slot !== "deckBackground"
      ? PASS_INFO[slot as "avatar" | "banner"]?.itemId
      : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCosmeticUploads(slot, slotIndex);
      setUploads(res.uploads);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [slot, slotIndex]);

  // Only relevant for avatar/banner (deckBackground never costs a
  // pass — see PASS_INFO's comment). Fetched once on mount so the
  // "Unlocked" badge reflects reality up front instead of only
  // surfacing pass status reactively after a failed upload attempt.
  useEffect(() => {
    if (!passItem) return;
    getInventory()
      .then((res) => setPassUnlocked(res.ownedItemIds.includes(passItem)))
      .catch(() => {
        /* badge just won't show — upload flow still works and will
           surface missing_pass correctly if they actually lack it */
      });
  }, [passItem]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ok ? 3500 : 8000);
    return () => clearTimeout(t);
  }, [toast]);

  // deckBackground has no animated tier at all — the deck card render
  // is a static composite regardless (see cosmeticUpload.ts's header),
  // so any GIF uploaded there is silently flattened server-side. Only
  // avatar/banner get the static+animated two-card layout below.
  const supportsAnimated = slot !== "deckBackground";

  const handleFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    intendedKind: "static" | "animated",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_MB * 1024 * 1024) {
      setToast({ msg: `File exceeds ${MAX_MB}MB limit.`, ok: false });
      return;
    }

    setUploadingKind(intendedKind);
    try {
      const res = await uploadCosmetic(slot, file, slotIndex);
      setToast({
        msg:
          res.kind === "animated"
            ? "Animated upload equipped!"
            : "Static upload equipped!",
        ok: true,
      });
      // An animated upload only succeeds if the pass was owned — a
      // successful static upload proves nothing about pass ownership.
      if (res.kind === "animated") setPassUnlocked(true);
      await load();
    } catch (err) {
      let msg = "Upload failed. Please try again.";
      if (err instanceof ApiResponseError) {
        if (err.status === 0) {
          msg =
            "Network error — couldn't reach the server. Check your connection.";
        } else if (err.error.code === "missing_pass") {
          msg = `Animated uploads need ${passItem ?? "a cosmetic pass"} — buy it once from the Shop to unlock animated uploads for this slot permanently.`;
        } else if (err.error.code === "invalid_file_type") {
          msg = "Unsupported file type. Use PNG, JPEG, WEBP, or GIF.";
        } else if (err.error.code === "file_too_large") {
          msg = `File is too large. Maximum size is ${MAX_MB}MB.`;
        } else if (err.error.code === "animation_too_long") {
          msg = err.error.message;
        } else {
          msg = err.error.message || msg;
        }
      } else if (err instanceof Error) {
        msg = err.message || msg;
      }
      setToast({ msg, ok: false });
    } finally {
      setUploadingKind(null);
    }
  };

  const handleEquip = async (u: CosmeticUpload) => {
    try {
      await equipCosmetic({ slot, uploadId: u.id, slotIndex });
      setToast({ msg: "Equipped!", ok: true });
      await load();
    } catch (err) {
      setToast({
        msg: err instanceof ApiResponseError ? err.error.message : "Failed.",
        ok: false,
      });
    }
  };

  const handleDelete = async (u: CosmeticUpload) => {
    try {
      await deleteCosmeticUpload(u.id);
      await load();
    } catch {
      setToast({ msg: "Couldn't delete — try again.", ok: false });
    }
  };

  const staticUpload = uploads.find((u) => u.kind === "static") ?? null;
  const animatedUpload = uploads.find((u) => u.kind === "animated") ?? null;
  const equippedUpload = uploads.find((u) => u.isEquipped);

  return (
    <div className="form-card flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-ayakashi-gold">
          {label}
        </h2>
        {equippedUpload && (
          <p className="text-[10px] text-[rgba(200,168,75,0.40)]">
            Currently equipped:{" "}
            {equippedUpload.kind === "animated" ? "✨ animated" : "static"}
          </p>
        )}
      </div>

      <RulesPill
        passItem={supportsAnimated ? passItem : undefined}
        unlocked={passUnlocked}
      />

      {toast && (
        <button
          type="button"
          onClick={() => setToast(null)}
          className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-xs transition-opacity hover:opacity-80 ${
            toast.ok
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {toast.ok ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </button>
      )}

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <FireSpinner size={28} />
        </div>
      ) : (
        <div
          className={`grid gap-2.5 ${supportsAnimated ? "grid-cols-2" : "grid-cols-1"}`}
        >
          <KindSlotCard
            kind="static"
            upload={staticUpload}
            aspectRatio={aspectRatio}
            uploading={uploadingKind === "static"}
            onUploadClick={() => staticFileRef.current?.click()}
            onEquip={() => staticUpload && handleEquip(staticUpload)}
            onDelete={() => staticUpload && handleDelete(staticUpload)}
          />
          {supportsAnimated && (
            <KindSlotCard
              kind="animated"
              upload={animatedUpload}
              aspectRatio={aspectRatio}
              locked={!passUnlocked && !animatedUpload}
              lockedReason={passItem ? `Needs ${passItem}` : "Locked"}
              uploading={uploadingKind === "animated"}
              onUploadClick={() => animatedFileRef.current?.click()}
              onEquip={() => animatedUpload && handleEquip(animatedUpload)}
              onDelete={() => animatedUpload && handleDelete(animatedUpload)}
            />
          )}
        </div>
      )}

      {/* Both file inputs accept the same mimetypes — the backend is
          the real source of truth for which kind an upload becomes
          (via sharp's page count), these two buttons just express
          intent so the "locked" state on the animated card can gate
          the animated button specifically. */}
      <input
        ref={staticFileRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => handleFile(e, "static")}
      />
      <input
        ref={animatedFileRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => handleFile(e, "animated")}
      />
    </div>
  );
}

// ── Frame section — real owned-frames grid, no blind text input ─────
function FrameSection() {
  const [frames, setFrames] = useState<OwnedFrameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInventory();
      setFrames(res.cosmetics.frames);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleEquip = async (frameId: string | null) => {
    setSaving(true);
    try {
      await equipCosmetic({ slot: "frame", frameId });
      setToast({
        msg: frameId ? "Frame equipped!" : "Frame removed.",
        ok: true,
      });
      await load();
    } catch (err) {
      setToast({
        msg: err instanceof ApiResponseError ? err.error.message : "Failed.",
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  };

  const equipped = frames.find((f) => f.isEquipped);

  return (
    <div className="form-card flex flex-col gap-4 rounded-xl border p-5">
      <div>
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-ayakashi-gold">
          Avatar Frame
        </h2>
        <p className="mt-1 text-xs leading-5 text-[rgba(200,168,75,0.50)]">
          Frames are earned in-game through events and rewards.
        </p>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
            toast.ok
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {toast.ok ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <FireSpinner size={24} />
        </div>
      ) : frames.length === 0 ? (
        <p className="py-6 text-center text-xs text-[rgba(200,168,75,0.35)]">
          You don't own any frames yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {frames.map((f) => (
              <button
                key={f.frameId}
                type="button"
                disabled={saving}
                onClick={() => handleEquip(f.isEquipped ? null : f.frameId)}
                className={`group relative flex flex-col items-center gap-1 rounded-md border p-2 text-center transition-all active:scale-95 disabled:opacity-50 ${
                  f.isEquipped
                    ? "border-ayakashi-gold ring-1 ring-ayakashi-gold/40"
                    : "border-[rgba(200,168,75,0.20)] hover:border-[rgba(200,168,75,0.45)]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.frameUrl}
                  alt={f.name}
                  className="h-12 w-12 object-contain"
                />
                <span className="line-clamp-1 text-[9px] text-[rgba(200,168,75,0.55)]">
                  {f.name}
                </span>
                {f.isEquipped && (
                  <div className="absolute right-0 top-0 rounded-bl-md bg-ayakashi-gold px-1 py-0.5">
                    <Check className="h-2.5 w-2.5 text-black" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {equipped && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleEquip(null)}
              className="h-9 rounded-md border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              Remove Frame
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Deck background slots ────────────────────────────────────────────
function DeckBackgroundsSection() {
  const [activeSlot, setActiveSlot] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto">
        {Array.from({ length: DECK_SLOT_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveSlot(i)}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
              activeSlot === i
                ? "border-ayakashi-gold bg-ayakashi-gold text-black"
                : "border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.55)] hover:border-ayakashi-gold/60"
            }`}
          >
            Deck {i + 1}
          </button>
        ))}
      </div>
      <SlotPanel
        key={activeSlot}
        slot="deckBackground"
        label={`Deck ${activeSlot + 1} Background`}
        aspectRatio="banner"
        slotIndex={activeSlot}
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function CosmeticsPage() {
  const [tab, setTab] = useState<TopTab>("avatar");

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="section-header">
        <span className="section-header-text">Cosmetics</span>
      </div>

      <hr className="gold-rule" />

      {/* Tabs */}
      <div className="flex gap-0 overflow-x-auto border-b border-[rgba(200,168,75,0.15)] scrollbar-none">
        {TOP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
              tab === t.id
                ? "text-ayakashi-gold"
                : "text-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.70)]"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-ayakashi-gold shadow-[0_0_8px_rgba(200,168,75,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {tab === "avatar" && (
        <SlotPanel slot="avatar" label="Avatar" aspectRatio="square" />
      )}
      {tab === "banner" && (
        <SlotPanel slot="banner" label="Profile Banner" aspectRatio="banner" />
      )}
      {tab === "frame" && <FrameSection />}
      {tab === "decks" && <DeckBackgroundsSection />}
    </section>
  );
}
