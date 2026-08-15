"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  getDecks,
  upsertDeck,
  assignCardToDeck,
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
const RARITY_RING: Record<string, string> = {
  UR: "rarity-ring-legendary",
  SSR: "rarity-ring-epic",
  SR: "rarity-ring-rare",
  R: "rarity-ring-uncommon",
  C: "rarity-ring-common",
};

const RARITY_TEXT: Record<string, string> = {
  UR: "text-[#e6c96a]",
  SSR: "text-purple-400",
  SR: "text-blue-400",
  R: "text-green-400",
  C: "text-[rgba(200,168,75,0.45)]",
};

// Small animated tile for deck slots and the card picker — same
// fileExtension branching as CardTile.tsx (webm needs a real <video>
// tag; next/image can't decode it and would strip gif animation), just
// without the pointer-tilt effect since these are dense small grids.
function DeckTileArt({
  mediaUrl,
  fileExtension,
}: {
  mediaUrl: string;
  fileExtension: string;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="flex h-full w-full items-center justify-center text-lg opacity-40">
        🃏
      </div>
    );
  }
  if (fileExtension === "webm") {
    return (
      <video
        src={mediaUrl}
        className="h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        onError={() => setBroken(true)}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={mediaUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

// ── Card picker modal ─────────────────────────────────────────────
function CardPickerModal({
  onPick,
  onClose,
}: {
  onPick: (instanceId: string) => void;
  onClose: () => void;
}) {
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
    load(1);
  }, [load]);

  const filtered = search.trim()
    ? cards.filter((c) =>
        c.card?.name.toLowerCase().includes(search.toLowerCase()),
      )
    : cards;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="craft-modal-pop form-card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-ayakashi-gold">
            Pick a Card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[rgba(200,168,75,0.5)] hover:text-ayakashi-gold"
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
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[rgba(200,168,75,0.40)]">
              No cards found.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {filtered.map((c) => {
                const rarity = c.card?.rarity ?? "C";
                return (
                  <button
                    key={c.instanceId}
                    type="button"
                    onClick={() => onPick(c.instanceId)}
                    disabled={c.isLocked}
                    className={`group relative overflow-hidden rounded-md ${RARITY_RING[rarity]} bg-[rgba(200,168,75,0.03)] transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40`}
                  >
                    {c.card?.mediaUrl ? (
                      <div className="aspect-[3/4] w-full">
                        <DeckTileArt
                          mediaUrl={c.card.mediaUrl}
                          fileExtension={c.card.fileExtension}
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center text-2xl">
                        🃏
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1.5 py-1">
                      <p className="truncate text-[9px] font-bold leading-tight text-[#f0e6c8]">
                        {c.card?.name ?? "?"}
                      </p>
                      <p
                        className={`text-[8px] font-bold ${RARITY_TEXT[rarity]}`}
                      >
                        {rarity}
                      </p>
                    </div>
                    {c.isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Lock className="h-4 w-4 text-red-400" />
                      </div>
                    )}
                  </button>
                );
              })}
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
              className="text-xs text-[rgba(200,168,75,0.60)] hover:text-ayakashi-gold disabled:opacity-30"
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
              className="text-xs text-[rgba(200,168,75,0.60)] hover:text-ayakashi-gold disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── One slot in the 12-slot grid — draggable if filled, always a drop
// target. useDraggable and useDroppable are combined on the same
// element via a merged ref, since any filled slot can also receive a
// drop (that's how swapping works).
function DeckSlotTile({
  pos,
  instanceId,
  cardData,
  busy,
  onTap,
}: {
  pos: number;
  instanceId: string | null;
  cardData: CardInstance | null;
  busy: boolean;
  onTap: (pos: number) => void;
}) {
  const rarity = cardData?.card?.rarity ?? "C";

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: pos,
    disabled: !instanceId || busy,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: pos });

  const setRefs = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  if (instanceId) {
    return (
      <button
        ref={setRefs}
        {...listeners}
        {...attributes}
        type="button"
        title="Drag to move, tap to remove"
        disabled={busy}
        onClick={() => onTap(pos)}
        className={`group relative aspect-[3/4] w-full touch-none overflow-hidden rounded-md ${RARITY_RING[rarity]} bg-[rgba(200,168,75,0.06)] transition-all disabled:opacity-50 ${
          isDragging
            ? "opacity-30"
            : isOver
              ? "ring-2 ring-ayakashi-gold scale-105"
              : "hover:-translate-y-0.5 active:scale-95"
        }`}
      >
        {cardData?.card?.mediaUrl ? (
          <DeckTileArt
            mediaUrl={cardData.card.mediaUrl}
            fileExtension={cardData.card.fileExtension}
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
          <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold text-white/90 drop-shadow">
            {cardData.card.rarity}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      ref={setDropRef}
      type="button"
      title="Assign card"
      disabled={busy}
      onClick={() => onTap(pos)}
      className={`flex aspect-[3/4] w-full items-center justify-center rounded-md border border-dashed bg-transparent transition-all active:scale-95 disabled:opacity-50 ${
        isOver
          ? "border-ayakashi-gold bg-ayakashi-gold/10 text-ayakashi-gold"
          : "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.25)] hover:border-ayakashi-gold/50 hover:text-ayakashi-gold/60"
      }`}
    >
      <Plus className="h-4 w-4" />
    </button>
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
  const [cardMap, setCardMap] = useState<Record<string, CardInstance>>({});

  // Real drag-and-drop via @dnd-kit — dragging a filled slot onto
  // another slot swaps them (or moves it, if the target is empty);
  // dropping outside any slot cancels. Replaces the old press-and-
  // hold-then-tap pseudo-DnD, which felt laggy and didn't give any
  // drag feedback until the hold timer fired.
  const [activeDragPos, setActiveDragPos] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
  );

  const slots12 = Array.from({ length: 12 }, (_, i) =>
    slot.slots ? (slot.slots[i] ?? null) : null,
  );
  const filledCount = slots12.filter(Boolean).length;

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

  const handleClearAll = async () => {
    if (
      !confirm(
        `Clear all cards from "${slot.deckName ?? `Deck ${slot.slotIndex + 1}`}"?`,
      )
    )
      return;
    setDeleting(true);
    try {
      // No DELETE /decks/:slotIndex endpoint — clear each filled slot
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

  // ── Drag start / end ──
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragPos(Number(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragPos(null);
    const { active, over } = event;
    if (!over) return; // dropped outside any slot — cancel

    const fromPos = Number(active.id);
    const pos = Number(over.id);
    if (fromPos === pos) return;

    const movingId = slots12[fromPos];
    const targetId = slots12[pos];
    if (!movingId) return;

    setBusy(true);
    try {
      if (targetId) {
        // Swap: move the target card out to the source slot first, then
        // move the held card in — two calls, since the backend has no
        // atomic swap endpoint, only position-explicit assign.
        await assignCardToDeck(slot.slotIndex, {
          position: fromPos,
          instanceId: targetId,
        });
      } else {
        await removeCardFromDeck(slot.slotIndex, fromPos);
      }
      await assignCardToDeck(slot.slotIndex, {
        position: pos,
        instanceId: movingId,
      });
      onRefresh();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  const handleTileTap = (pos: number) => {
    // A plain tap (no drag distance crossed) still works the old way —
    // tap a filled slot to remove, tap an empty slot to open the picker.
    if (slots12[pos]) handleRemove(pos);
    else setPickerPos(pos);
  };

  return (
    <div className="craft-card flex flex-col gap-4 overflow-hidden rounded-xl">
      {/* Deck background — full-bleed strip if set, otherwise a quiet gradient */}
      <div className="relative h-24 w-full overflow-hidden">
        {slot.backgroundUrl ? (
          <Image
            src={slot.backgroundUrl}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[rgba(200,168,75,0.10)] to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

        {/* Header overlaid on the background strip */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-4 pb-3">
          {editing ? (
            <div
              className="flex flex-1 items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
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
                className="text-[rgba(200,168,75,0.50)] hover:text-ayakashi-gold"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <span className="font-display truncate text-base font-bold text-[#f0e6c8] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                {slot.deckName ?? `Deck ${slot.slotIndex + 1}`}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(slot.deckName ?? "");
                    setEditing(true);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-[rgba(200,168,75,0.70)] backdrop-blur-sm hover:text-ayakashi-gold"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={deleting || filledCount === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-red-400/70 backdrop-blur-sm hover:text-red-400 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {/* 12-slot grid — larger, art-forward, animated tiles, real
            drag-and-drop via @dnd-kit */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots12.map((instanceId, pos) => (
              <DeckSlotTile
                key={pos}
                pos={pos}
                instanceId={instanceId}
                cardData={instanceId ? (cardMap[instanceId] ?? null) : null}
                busy={busy}
                onTap={handleTileTap}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
            {activeDragPos !== null && slots12[activeDragPos]
              ? (() => {
                  const draggedId = slots12[activeDragPos]!;
                  const draggedCard = cardMap[draggedId];
                  const rarity = draggedCard?.card?.rarity ?? "C";
                  return (
                    <div
                      className={`aspect-[3/4] w-16 overflow-hidden rounded-md ${RARITY_RING[rarity]} bg-[rgba(200,168,75,0.06)] shadow-[0_8px_24px_rgba(0,0,0,0.6)]`}
                    >
                      {draggedCard?.card?.mediaUrl ? (
                        <DeckTileArt
                          mediaUrl={draggedCard.card.mediaUrl}
                          fileExtension={draggedCard.card.fileExtension}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg">
                          🃏
                        </div>
                      )}
                    </div>
                  );
                })()
              : null}
          </DragOverlay>
        </DndContext>

        <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
          {filledCount} / 12 slots filled · drag a card to move it
        </p>
      </div>

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
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
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
                className="flex items-center gap-3 rounded-xl border border-dashed border-[rgba(200,168,75,0.15)] p-5 opacity-40"
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
                className="flex items-center justify-between rounded-xl border border-dashed border-[rgba(200,168,75,0.25)] p-5"
              >
                <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                  Slot {slot.slotIndex + 1} — Empty
                </span>
                <button
                  type="button"
                  disabled={creating === slot.slotIndex}
                  onClick={() => handleCreateDeck(slot.slotIndex)}
                  className="flex items-center gap-1.5 rounded-md border border-ayakashi-gold px-4 py-2 text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:opacity-40"
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
