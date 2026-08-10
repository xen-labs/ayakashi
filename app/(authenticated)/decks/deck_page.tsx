"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import {
  getDecks,
  upsertDeck,
  assignCardToDeck,
  deleteDeck,
  removeCardFromDeck,
  getInventoryCards,
  ApiResponseError,
} from "../../../lib/api";
import type {
  DecksResponse,
  DeckManageSlot,
  CardInstance,
} from "../../../lib/api";

// ── helpers ───────────────────────────────────────────────────────
const RARITY_COLORS: Record<string, string> = {
  UR: "border-[#FFD700]/50",
  SSR: "border-purple-400/50",
  SR: "border-blue-400/50",
  R: "border-green-400/50",
  C: "border-[rgba(200,168,75,0.25)]",
};

// ── Card picker modal ─────────────────────────────────────────────
function CardPickerModal({
  onPick,
  onClose,
}: {
  onPick: (instanceId: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [cards, setCards] = useState<CardInstance[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await getInventoryCards({ page: p, sort: "rarity" });
      setCards(res.items);
      setTotalPages(res.totalPages);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    dialogRef.current?.showModal();
    load(1);
  }, [load]);

  const filtered = search.trim()
    ? cards.filter((c) =>
        c.card?.name.toLowerCase().includes(search.toLowerCase()),
      )
    : cards;

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-full max-w-lg border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col"
    >
      <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
          Pick a Card
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[rgba(200,168,75,0.5)] hover:text-[#c8a84b]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="form-input h-9 w-full border px-3 text-sm outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
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
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((c) => (
              <button
                key={c.instanceId}
                type="button"
                onClick={() => onPick(c.instanceId)}
                className={`relative overflow-hidden border ${RARITY_COLORS[c.card?.rarity ?? "C"]} bg-[rgba(200,168,75,0.03)] transition-all hover:border-[#c8a84b]`}
              >
                {c.card?.mediaUrl ? (
                  <Image
                    src={c.card.mediaUrl}
                    alt={c.card.name}
                    width={100}
                    height={140}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center text-2xl">
                    🃏
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                  <p className="truncate text-[8px] font-bold text-[#f0e6c8]">
                    {c.card?.name ?? "?"}
                  </p>
                  <p className="text-[7px] text-[rgba(200,168,75,0.50)]">
                    {c.card?.rarity}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[rgba(200,168,75,0.15)] px-5 py-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => p - 1);
              load(page - 1);
            }}
            className="text-xs text-[rgba(200,168,75,0.60)] disabled:opacity-30 hover:text-[#c8a84b]"
          >
            ← Prev
          </button>
          <span className="text-xs text-[rgba(200,168,75,0.40)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((p) => p + 1);
              load(page + 1);
            }}
            className="text-xs text-[rgba(200,168,75,0.60)] disabled:opacity-30 hover:text-[#c8a84b]"
          >
            Next →
          </button>
        </div>
      )}
    </dialog>
  );
}

// ── Single deck editor ────────────────────────────────────────────
function DeckEditor({
  slot,
  onRefresh,
}: {
  slot: DeckManageSlot;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(slot.deckName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [pickerPos, setPickerPos] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // instanceId → card data for filled slots
  const [cardMap, setCardMap] = useState<Record<string, CardInstance>>({});

  const slots12 = Array.from({ length: 12 }, (_, i) =>
    slot.slots ? (slot.slots[i] ?? null) : null,
  );

  // Fetch card details whenever the slot composition changes
  useEffect(() => {
    const filledIds = (slot.slots ?? []).filter(Boolean) as string[];
    if (filledIds.length === 0) {
      setCardMap({});
      return;
    }
    getInventoryCards({ sort: "rarity" })
      .then((res) => {
        const map: Record<string, CardInstance> = {};
        for (const c of res.items) map[c.instanceId] = c;
        setCardMap(map);
      })
      .catch(() => {
        /* noop */
      });
  }, [slot.slots]);

  const saveName = async () => {
    setSavingName(true);
    try {
      await upsertDeck(slot.slotIndex, {
        deckName: nameInput.trim() || undefined,
      });
      setEditing(false);
      onRefresh();
    } catch {
      /* noop */
    } finally {
      setSavingName(false);
    }
  };

  const handleAssign = async (instanceId: string) => {
    if (pickerPos === null) return;
    setBusy(true);
    setPickerPos(null);
    try {
      await assignCardToDeck(slot.slotIndex, {
        position: pickerPos,
        instanceId,
      });
      onRefresh();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (pos: number) => {
    if (!slots12[pos]) return;
    setBusy(true);
    try {
      await removeCardFromDeck(slot.slotIndex, pos);
      onRefresh();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Clear all cards from "${slot.deckName ?? `Deck ${slot.slotIndex + 1}`}"?`,
      )
    )
      return;
    setDeleting(true);
    try {
      // No DELETE /decks/:slotIndex endpoint — clear each filled slot individually
      const filled = slots12
        .map((id, i) => ({ id, i }))
        .filter(({ id }) => id !== null);
      await Promise.all(
        filled.map(({ i }) => removeCardFromDeck(slot.slotIndex, i)),
      );
      onRefresh();
    } catch {
      /* noop */
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="form-card flex flex-col gap-4 border p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={40}
              autoFocus
              className="form-input h-8 flex-1 border px-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={savingName}
              className="text-green-400 hover:text-green-300 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[rgba(200,168,75,0.50)] hover:text-[#c8a84b]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <span className="font-display text-sm font-bold text-[#f0e6c8]">
              {slot.deckName ?? `Deck ${slot.slotIndex + 1}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNameInput(slot.deckName ?? "");
                  setEditing(true);
                }}
                className="text-[rgba(200,168,75,0.45)] hover:text-[#c8a84b]"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-400/60 hover:text-red-400 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* 12-slot grid */}
      <div className="grid grid-cols-6 gap-1.5">
        {slots12.map((instanceId, pos) => {
          const cardData = instanceId ? cardMap[instanceId] : null;
          return (
            <div key={pos} className="relative">
              {instanceId ? (
                <button
                  type="button"
                  title="Click to remove"
                  disabled={busy}
                  onClick={() => handleRemove(pos)}
                  className={`group relative h-16 w-full overflow-hidden border ${RARITY_COLORS[cardData?.card?.rarity ?? "C"]} bg-[rgba(200,168,75,0.06)] hover:border-red-500/50 disabled:opacity-50`}
                >
                  {cardData?.card?.mediaUrl ? (
                    <Image
                      src={cardData.card.mediaUrl}
                      alt={cardData.card.name ?? "card"}
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">
                      🃏
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/70">
                    <X className="h-4 w-4 text-red-400 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {cardData?.card?.rarity && (
                    <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold text-white/80 drop-shadow">
                      {cardData.card.rarity}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  title="Assign card"
                  disabled={busy}
                  onClick={() => setPickerPos(pos)}
                  className="flex h-16 w-full items-center justify-center border border-dashed border-[rgba(200,168,75,0.20)] bg-transparent text-[rgba(200,168,75,0.25)] transition-all hover:border-[rgba(200,168,75,0.50)] hover:text-[rgba(200,168,75,0.60)] disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
        {slots12.filter(Boolean).length} / 12 slots filled
      </p>

      {pickerPos !== null && (
        <CardPickerModal
          onPick={handleAssign}
          onClose={() => setPickerPos(null)}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function DecksPage() {
  const router = useRouter();
  const [data, setData] = useState<DecksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDecks());
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError("Couldn't load decks.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateDeck = async (slotIndex: number) => {
    setCreating(slotIndex);
    try {
      await upsertDeck(slotIndex, { deckName: `Deck ${slotIndex + 1}` });
      await load();
    } catch {
      /* noop */
    } finally {
      setCreating(null);
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
        <p className="text-sm text-[rgba(200,168,75,0.60)]">{error}</p>
        <button type="button" onClick={load} className="brush-btn w-40">
          Retry
        </button>
      </div>
    );

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="section-header">
        <span className="section-header-text">Decks</span>
      </div>

      <hr className="gold-rule" />

      <p className="text-xs text-[rgba(200,168,75,0.45)]">
        {data.unlockedCount} / {data.maxDecks} slots unlocked · {data.deckSize}{" "}
        cards per deck
      </p>

      <div className="flex flex-col gap-5">
        {data.slots.map((slot) => {
          if (slot.state === "locked") {
            return (
              <div
                key={slot.slotIndex}
                className="flex items-center gap-3 border border-dashed border-[rgba(200,168,75,0.15)] p-5 opacity-40"
              >
                <Lock className="h-4 w-4 text-[rgba(200,168,75,0.40)]" />
                <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                  Slot {slot.slotIndex + 1} — Locked (buy a Deck Pass to unlock)
                </span>
              </div>
            );
          }
          if (slot.state === "empty") {
            return (
              <div
                key={slot.slotIndex}
                className="flex items-center justify-between border border-dashed border-[rgba(200,168,75,0.25)] p-5"
              >
                <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                  Slot {slot.slotIndex + 1} — Empty
                </span>
                <button
                  type="button"
                  disabled={creating === slot.slotIndex}
                  onClick={() => handleCreateDeck(slot.slotIndex)}
                  className="flex items-center gap-1.5 border border-[#c8a84b] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {creating === slot.slotIndex ? "Creating…" : "Add Deck"}
                </button>
              </div>
            );
          }
          return (
            <DeckEditor key={slot.slotIndex} slot={slot} onRefresh={load} />
          );
        })}
      </div>
    </section>
  );
}
