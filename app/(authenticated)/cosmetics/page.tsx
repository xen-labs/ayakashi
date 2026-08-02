"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, Trash2, Check, AlertCircle, Info } from "lucide-react";
import {
  getCosmeticUploads,
  uploadCosmetic,
  equipCosmetic,
  deleteCosmeticUpload,
  ApiResponseError,
} from "../../../lib/api";
import type { CosmeticSlot, CosmeticUpload } from "../../../lib/api";

// ── constants matching the backend ───────────────────────────────
// cosmeticUpload.ts: MAX_FILE_BYTES = 32MB, ALLOWED_MIMETYPES = png/jpeg/webp/gif
// Animated (pages > 1 per sharp) costs avatar_pass or banner_pass.
// Static (single frame) is always free.
const MAX_MB = 32;
const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";

// ── pass info per slot ────────────────────────────────────────────
const PASS_INFO: Record<"avatar" | "banner", { itemId: string; label: string }> = {
  avatar:  { itemId: "avatar_pass",  label: "avatar_pass"  },
  banner:  { itemId: "banner_pass",  label: "banner_pass"  },
};

// ── Rules pill ────────────────────────────────────────────────────
function RulesPill({ passItem }: { passItem?: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-none border border-[rgba(200,168,75,0.15)] bg-[rgba(200,168,75,0.04)] px-3 py-2.5 text-[10px] leading-5 text-[rgba(200,168,75,0.55)]">
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-[rgba(200,168,75,0.40)]" />
      <span>
        <span className="font-bold text-[rgba(200,168,75,0.70)]">Static</span> PNG · JPEG · WEBP — free, no limit on swaps.
        {passItem && (
          <>
            {" "}<span className="font-bold text-purple-400">Animated</span> GIF · animated WEBP — costs 1×{" "}
            <code className="rounded bg-purple-500/10 px-1 text-purple-300">{passItem}</code> per upload.
          </>
        )}
        {" "}Max file size: {MAX_MB}MB. Uploaded images are stored and can be re-equipped any time for free.
      </span>
    </div>
  );
}

// ── Upload thumbnail ──────────────────────────────────────────────
function UploadThumb({
  upload,
  onEquip,
  onDelete,
  aspectRatio,
}: {
  upload: CosmeticUpload;
  onEquip: () => void;
  onDelete: () => void;
  aspectRatio: "square" | "banner";
}) {
  const h = aspectRatio === "banner" ? "h-16" : "h-20";
  return (
    <div
      className={`group relative overflow-hidden border transition-all ${
        upload.isEquipped
          ? "border-[#c8a84b] ring-1 ring-[#c8a84b]/40"
          : "border-[rgba(200,168,75,0.20)] hover:border-[rgba(200,168,75,0.45)]"
      }`}
    >
      {/* Image — use <img> so animated GIFs/WEBPs play */}
      <div className={`relative w-full ${h} bg-[rgba(200,168,75,0.04)]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={upload.url}
          alt={upload.kind}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 transition-all group-hover:bg-black/65">
        {!upload.isEquipped && (
          <button
            type="button"
            onClick={onEquip}
            title="Equip"
            className="flex h-8 w-8 items-center justify-center border border-[#c8a84b] bg-black/80 text-[#c8a84b] opacity-0 transition-opacity hover:bg-[#c8a84b] hover:text-black group-hover:opacity-100"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="flex h-8 w-8 items-center justify-center border border-red-500/50 bg-black/80 text-red-400 opacity-0 transition-opacity hover:bg-red-500/20 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Equipped badge */}
      {upload.isEquipped && (
        <div className="absolute right-0 top-0 bg-[#c8a84b] px-1 py-0.5">
          <Check className="h-2.5 w-2.5 text-black" />
        </div>
      )}

      {/* Animated badge */}
      {upload.kind === "animated" && (
        <div className="absolute left-0 top-0 bg-purple-600/90 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest text-white">
          GIF
        </div>
      )}

      <p className="truncate px-1 py-0.5 text-[8px] text-[rgba(200,168,75,0.35)]">
        {new Date(upload.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </p>
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
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const passItem = slot !== "deckBackground" ? PASS_INFO[slot as "avatar" | "banner"]?.itemId : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCosmeticUploads(slot, slotIndex);
      setUploads(res.uploads);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [slot, slotIndex]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    // Errors stay longer so the user can read them
    const t = setTimeout(() => setToast(null), toast.ok ? 3500 : 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Client-side size guard
    if (file.size > MAX_MB * 1024 * 1024) {
      setToast({ msg: `File exceeds ${MAX_MB}MB limit.`, ok: false });
      return;
    }

    setUploading(true);
    try {
      await uploadCosmetic(slot, file, slotIndex);
      setToast({ msg: "Uploaded and equipped!", ok: true });
      await load();
    } catch (err) {
      let msg = "Upload failed. Please try again.";
      if (err instanceof ApiResponseError) {
        if (err.status === 0) {
          msg = "Network error — couldn't reach the server. Check your connection.";
        } else if (err.error.code === "missing_pass") {
          msg = `Animated uploads require a ${passItem ?? "cosmetic pass"} in your inventory.`;
        } else if (err.error.code === "invalid_file_type") {
          msg = "Unsupported file type. Use PNG, JPEG, WEBP, or GIF.";
        } else if (err.error.code === "file_too_large") {
          msg = `File is too large. Maximum size is ${MAX_MB}MB.`;
        } else {
          msg = err.error.message || msg;
        }
      } else if (err instanceof Error) {
        msg = err.message || msg;
      }
      setToast({ msg, ok: false });
    } finally { setUploading(false); }
  };

  const handleEquip = async (u: CosmeticUpload) => {
    try {
      await equipCosmetic({ slot, uploadId: u.id, slotIndex });
      setToast({ msg: "Equipped!", ok: true });
      await load();
    } catch (err) {
      setToast({ msg: err instanceof ApiResponseError ? err.error.message : "Failed.", ok: false });
    }
  };

  const handleDelete = async (u: CosmeticUpload) => {
    if (!confirm("Remove this upload? This only removes it from your library — your profile will revert to the previous image if this was equipped.")) return;
    try {
      await deleteCosmeticUpload(u.id);
      await load();
    } catch { /* noop */ }
  };

  const equippedUpload = uploads.find(u => u.isEquipped);

  return (
    <div className="form-card flex flex-col gap-4 border p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-[#c8a84b]">{label}</h2>
          {equippedUpload && (
            <p className="text-[10px] text-[rgba(200,168,75,0.40)]">
              Currently equipped: {equippedUpload.kind === "animated" ? "✨ animated" : "static"}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex shrink-0 items-center gap-1.5 border border-[#c8a84b] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:opacity-40"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* Rules */}
      <RulesPill passItem={passItem} />

      {/* Toast — clickable to dismiss */}
      {toast && (
        <button
          type="button"
          onClick={() => setToast(null)}
          className={`flex w-full items-start gap-2 border px-3 py-2 text-xs text-left transition-opacity hover:opacity-80 ${
            toast.ok
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {toast.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{toast.msg}</span>
        </button>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <svg className="h-5 w-5 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      ) : uploads.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Upload className="h-6 w-6 text-[rgba(200,168,75,0.25)]" />
          <p className="text-xs text-[rgba(200,168,75,0.35)]">
            No uploads yet. Upload an image to get started.
          </p>
        </div>
      ) : (
        <div className={`grid gap-2 ${aspectRatio === "banner" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-5"}`}>
          {uploads.map(u => (
            <UploadThumb
              key={u.id}
              upload={u}
              aspectRatio={aspectRatio}
              onEquip={() => handleEquip(u)}
              onDelete={() => handleDelete(u)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Frame section ─────────────────────────────────────────────────
function FrameSection() {
  const [frameId, setFrameId] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleEquip = async () => {
    setSaving(true);
    try {
      await equipCosmetic({ slot: "frame", frameId: frameId.trim() || null });
      setToast({ msg: frameId.trim() ? "Frame equipped!" : "Frame removed.", ok: true });
      setFrameId("");
    } catch (err) {
      setToast({ msg: err instanceof ApiResponseError ? err.error.message : "Failed.", ok: false });
    } finally { setSaving(false); }
  };

  return (
    <div className="form-card flex flex-col gap-4 border p-5">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-[#c8a84b]">Avatar Frame</h2>
      <p className="text-xs leading-5 text-[rgba(200,168,75,0.50)]">
        Frames are earned in-game through events and rewards. Enter a frame ID to equip it on your avatar, or leave the field blank to remove your current frame.
      </p>

      {toast && (
        <div className={`flex items-center gap-2 border px-3 py-2 text-xs ${
          toast.ok ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}>
          {toast.ok ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {toast.msg}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={frameId}
          onChange={e => setFrameId(e.target.value)}
          placeholder="Enter frame ID (blank = remove)"
          className="form-input h-9 flex-1 border px-3 text-sm outline-none"
        />
        <button
          type="button"
          disabled={saving}
          onClick={handleEquip}
          className="h-9 border border-[#c8a84b] px-4 text-xs font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black disabled:opacity-40"
        >
          {saving ? "…" : "Equip"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function CosmeticsPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

      <div className="section-header">
        <span className="section-header-text">Cosmetics</span>
      </div>

      <hr className="gold-rule" />

      {/* Avatar */}
      <SlotPanel slot="avatar" label="Avatar" aspectRatio="square" />

      {/* Banner */}
      <SlotPanel slot="banner" label="Profile Banner" aspectRatio="banner" />

      {/* Frame */}
      <FrameSection />

    </section>
  );
}
