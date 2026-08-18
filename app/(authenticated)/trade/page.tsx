"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Plus,
    X,
    ArrowLeftRight,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Gift
} from "lucide-react";
import {
    getTrades,
    getTradeById,
    proposeTrade,
    acceptTrade,
    declineTrade,
    cancelTrade,
    counterTrade,
    searchPlayers,
    getInventoryCards,
    getInventory,
    getMe,
    ApiResponseError
} from "../../../lib/api";
import type {
    Trade,
    TradeCurrency,
    TradeOffer,
    TradeOfferDisplay,
    TradeOfferCard,
    CardInstance,
    InventoryItem,
    PlayerSearchResult
} from "../../../lib/api";
import { CurrencyIcon } from "../../components/CurrencyIcon";

// ── helpers ───────────────────────────────────────────────────────
function fmt(n: number) {
    return n.toLocaleString("en-US");
}

const STATUS_BADGE: Record<
    string,
    { label: string; cls: string; pulse?: boolean }
> = {
    pending: {
        label: "Pending",
        cls: "border-amber-500/40 text-amber-400 bg-amber-500/10",
        pulse: true
    },
    countered: {
        label: "Countered",
        cls: "border-blue-500/40 text-blue-400 bg-blue-500/10",
        pulse: true
    },
    accepted: {
        label: "Accepted",
        cls: "border-green-500/40 text-green-400 bg-green-500/10"
    },
    declined: {
        label: "Declined",
        cls: "border-red-500/40 text-red-400 bg-red-500/10"
    },
    cancelled: {
        label: "Cancelled",
        cls: "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.40)] bg-transparent"
    },
    expired: {
        label: "Expired",
        cls: "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.40)] bg-transparent"
    }
};

// ── A single small card thumbnail used inside an offer summary — same
// rarity-tinted border language as the propose modal's picker tiles,
// just smaller and non-interactive (this is a read-only summary, not a
// selector). object-contain + no forced background, same no-crop-box
// convention the rest of the app's card art follows.
const RARITY_BORDER: Record<string, string> = {
    C: "border-[rgba(200,168,75,0.20)]",
    R: "border-[rgba(120,200,150,0.45)]",
    SR: "border-[rgba(90,160,230,0.5)]",
    SSR: "border-[rgba(190,110,230,0.55)]",
    UR: "border-[rgba(230,180,60,0.65)]"
};

function OfferCardThumb({ item }: { item: TradeOfferCard }) {
    const rarity = item.card?.rarity ?? "C";
    return (
        <div
            className={`group relative aspect-[3/4] w-full overflow-hidden rounded-sm border ${RARITY_BORDER[rarity]}`}
            title={item.card?.name ?? "Unknown card"}
        >
            {item.card ? (
                item.card.fileExtension === "webm" ? (
                    <video
                        src={item.card.mediaUrl}
                        className="h-full w-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                    />
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.card.mediaUrl}
                        alt={item.card.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                )
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-[rgba(200,168,75,0.05)] text-lg">
                    🃏
                </div>
            )}
            {/* name on hover/focus only — the thumbnail carries the
                identity visually, this is just a fallback for anyone who
                wants to confirm the exact card without guessing from art
                alone (small thumbnails of similar-looking cards can be
                hard to tell apart at a glance). */}
            {item.card && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1 py-1 text-[8px] font-semibold text-[#f0e6c8] opacity-0 transition-opacity group-hover:opacity-100">
                    {item.card.name}
                </div>
            )}
        </div>
    );
}

// ── Offer summary ─────────────────────────────────────────────────
function OfferSummary({
    offer,
    label,
    delay = 0
}: {
    offer: TradeOfferDisplay;
    label?: string;
    delay?: number;
}) {
    const empty =
        offer.cards.length === 0 &&
        offer.materials.length === 0 &&
        !offer.currency;
    return (
        <div
            className="trade-offer-in flex flex-col gap-2"
            style={{ animationDelay: `${delay}ms` }}
        >
            {label && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                    {label}
                </p>
            )}
            {empty ? (
                <p className="text-xs text-[rgba(200,168,75,0.30)]">
                    Nothing offered
                </p>
            ) : (
                <>
                    {/* [FIXED] Previously printed only "🃏 N cards" —
                        offer.cardInstanceIds had nothing else to render.
                        serializeTrade now resolves each instance against
                        CardInstance/Card before sending (same pattern
                        materials already used against itemRegistry), so
                        this shows the actual cards on the table. */}
                    {offer.cards.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                            {offer.cards.map(c => (
                                <OfferCardThumb key={c.instanceId} item={c} />
                            ))}
                        </div>
                    )}
                    {/* [FIXED] Previously printed the raw itemId ("3× mat_scrap_metal")
              since ITradeOffer.materials on the wire was just {itemId,
              quantity} with nothing to render. serializeTrade now resolves
              each material against itemRegistry.ts before sending, same as
              craft/inventory already do — real name + art here, itemId
              fallback icon only if an old trade references a removed item. */}
                    {offer.materials.map(m => (
                        <div
                            key={m.itemId}
                            className="flex items-center gap-1.5 text-xs text-[#f0e6c8]"
                        >
                            {m.webappImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={m.webappImage}
                                    alt={m.name}
                                    className="h-4 w-4 shrink-0 object-contain"
                                />
                            ) : (
                                <span className="text-sm leading-none">
                                    {m.emoji}
                                </span>
                            )}
                            <span>
                                {m.quantity}× {m.name}
                            </span>
                        </div>
                    ))}
                    {offer.currency && (
                        <p className="flex items-center gap-1 text-xs text-[#f0e6c8]">
                            <CurrencyIcon
                                type={offer.currency.type}
                                size={12}
                            />
                            {fmt(offer.currency.amount)} {offer.currency.type}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

// ── Trade row ─────────────────────────────────────────────────────
// ── Tiny overlapping thumbnail stack for a list row — shows up to 3
// card thumbnails from an offer, overlapping like a hand of cards, with
// a "+N" tag if there are more. Deliberately much smaller/simpler than
// OfferCardThumb (no rarity border, no hover name) since this is just a
// glance-preview inside a dense list, not something anyone reads closely.
function OfferThumbStack({ cards }: { cards: TradeOfferCard[] }) {
    if (cards.length === 0) return null;
    const visible = cards.slice(0, 3);
    const extra = cards.length - visible.length;
    return (
        <div className="flex items-center">
            {visible.map((c, i) => (
                <div
                    key={c.instanceId}
                    className="h-7 w-6 shrink-0 overflow-hidden rounded-sm border border-[rgba(200,168,75,0.25)] bg-[rgba(200,168,75,0.05)]"
                    style={{
                        marginLeft: i === 0 ? 0 : -10,
                        zIndex: visible.length - i
                    }}
                >
                    {c.card ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={c.card.mediaUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[8px]">
                            🃏
                        </div>
                    )}
                </div>
            ))}
            {extra > 0 && (
                <span className="z-0 -ml-2.5 flex h-7 w-6 shrink-0 items-center justify-center rounded-sm border border-[rgba(200,168,75,0.25)] bg-black/70 text-[8px] font-bold text-[rgba(200,168,75,0.7)]">
                    +{extra}
                </span>
            )}
        </div>
    );
}

function TradeRow({
    trade,
    myUsername,
    index,
    onSelect
}: {
    trade: Trade;
    myUsername: string;
    index: number;
    onSelect: () => void;
}) {
    const badge = STATUS_BADGE[trade.status] ?? STATUS_BADGE.pending;
    // Only meaningful while the trade is still pending/countered — a
    // resolved trade has no "turn" left to take. Mirrors
    // TradeDetailModal's myTurn derivation exactly (see its comment for
    // the full reasoning) so the list badge and the opened detail view
    // never disagree about whose move it is.
    const isInitiator = trade.initiator.username === myUsername;
    const isRecipient = trade.recipient.username === myUsername;
    const isPending =
        trade.status === "pending" || trade.status === "countered";
    const iProposedCurrentTerms =
        (isInitiator && trade.proposedBy === "initiator") ||
        (isRecipient && trade.proposedBy === "recipient");
    const myTurn = isPending && !iProposedCurrentTerms;

    // Combined preview across both sides — a player scanning the list
    // wants "what's on the table at all," not which specific side each
    // card belongs to (that distinction is what opening the row is for).
    const previewCards = [
        ...trade.initiator.offer.cards,
        ...trade.recipient.offer.cards
    ];

    return (
        <button
            type="button"
            onClick={onSelect}
            className="trade-row-in group flex w-full items-start gap-3 border-b border-[rgba(200,168,75,0.08)] px-2 py-3 text-left transition-colors last:border-0 hover:bg-[rgba(200,168,75,0.04)]"
            style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
        >
            <ArrowLeftRight className="trade-swap-icon mt-0.5 h-4 w-4 shrink-0 text-[rgba(200,168,75,0.40)] transition-colors group-hover:text-[#c8a84b]" />
            <div className="flex flex-1 flex-col gap-1 min-w-0">
                <p className="truncate text-sm font-bold text-[#f0e6c8]">
                    {trade.initiator.displayName} →{" "}
                    {trade.recipient.displayName}
                </p>
                <p className="text-[10px] text-[rgba(200,168,75,0.40)]">
                    {new Date(trade.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                    })}
                </p>
                {previewCards.length > 0 && (
                    <div className="mt-0.5">
                        <OfferThumbStack cards={previewCards} />
                    </div>
                )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                    className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${badge.cls} ${badge.pulse ? "trade-status-pending" : ""}`}
                >
                    {badge.label}
                </span>
                {/* Same signal as the detail modal's "Waiting for X" line, just
            compressed to fit a list row — lets a player scan Active
            trades and immediately see which ones need them, without
            opening each one. */}
                {isPending && (
                    <span
                        className={`text-[8px] font-bold uppercase tracking-wide ${
                            myTurn
                                ? "text-green-400"
                                : "text-[rgba(200,168,75,0.35)]"
                        }`}
                    >
                        {myTurn ? "Your move" : "Waiting on them"}
                    </span>
                )}
            </div>
        </button>
    );
}

// ── One side's full offer panel in the detail modal — player identity
// chip (avatar + name, "You" swapped in for the viewer's own side) on
// top of a bordered card containing that side's OfferSummary. Gives the
// two offers a clear visual boundary instead of floating as loose text
// next to each other, and the avatar makes it immediately obvious whose
// offer is whose without re-reading the label every time.
function TradeOfferPanel({
    side,
    isMe,
    offer,
    highlighted,
    delay = 0
}: {
    side: { displayName: string; avatarUrl: string | null };
    isMe: boolean;
    offer: TradeOfferDisplay;
    highlighted: boolean;
    delay?: number;
}) {
    return (
        <div
            className={`flex flex-1 flex-col gap-3 border p-3.5 transition-colors ${
                highlighted
                    ? "border-[#c8a84b]/50 bg-[rgba(200,168,75,0.04)]"
                    : "border-[rgba(200,168,75,0.15)]"
            }`}
        >
            <div className="flex items-center gap-2">
                <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[rgba(200,168,75,0.12)]">
                    {side.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={side.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[rgba(200,168,75,0.6)]">
                            {side.displayName.slice(0, 1).toUpperCase()}
                        </div>
                    )}
                </div>
                <p className="truncate text-sm font-bold text-[#f0e6c8]">
                    {isMe ? "You" : side.displayName}
                </p>
                {highlighted && (
                    <span className="ml-auto shrink-0 text-[8px] font-bold uppercase tracking-widest text-[#c8a84b]">
                        Current terms
                    </span>
                )}
            </div>
            <OfferSummary offer={offer} delay={delay} />
        </div>
    );
}

// ── Trade detail modal ────────────────────────────────────────────
function TradeDetailModal({
    tradeId,
    myUsername,
    onClose,
    onRefresh
}: {
    tradeId: string;
    myUsername: string;
    onClose: () => void;
    onRefresh: () => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [trade, setTrade] = useState<Trade | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        dialogRef.current?.showModal();
        getTradeById(tradeId)
            .then(setTrade)
            .catch(() => setError("Couldn't load trade."));
    }, [tradeId]);

    // FIX: was comparing trade.initiator/recipient.jid against a myJid
    // state that was never actually set anywhere (see TradePage below) —
    // isInitiator/isRecipient were always false, so accept/decline/cancel
    // never rendered. TradeSide has no jid the frontend can independently
    // obtain (MeResponse/GET /me deliberately doesn't expose jid — see
    // routes/me.ts), so this compares on username instead, which IS
    // available from getMe(). TradeSide.username can be null for the
    // OTHER party (unregistered players can still be traded with), but
    // never for the logged-in viewer themselves — this page requires a
    // session, so "me" always has a username.
    const isInitiator = trade?.initiator.username === myUsername;
    const isRecipient = trade?.recipient.username === myUsername;

    // [FIXED] This is the actual fix for "I accept, then have to wait" —
    // trade.proposedBy (now sent by serializeTrade, previously computed
    // server-side but never included in the response) tells us who set
    // the CURRENT terms. That person implicitly already agrees to them;
    // the backend's /accept route rejects their own Accept click with
    // waiting_on_other_side, but the old UI showed the button to both
    // sides regardless and just surfaced that as a raw error string.
    // myTurn means: it's genuinely possible for ME to accept right now —
    // the other side proposed/countered last, and I haven't already
    // locked in my agreement to these exact terms.
    const iProposedCurrentTerms =
        (isInitiator && trade?.proposedBy === "initiator") ||
        (isRecipient && trade?.proposedBy === "recipient");
    const myTurn = Boolean(trade) && !iProposedCurrentTerms;
    const otherPartyName = isInitiator
        ? trade?.recipient.displayName
        : trade?.initiator.displayName;
    const active = trade?.status === "pending" || trade?.status === "countered";

    const act = async (fn: () => Promise<Trade>) => {
        setBusy(true);
        setError("");
        try {
            await fn();
            onRefresh();
            onClose();
        } catch (err) {
            setError(
                err instanceof ApiResponseError
                    ? err.error.message
                    : "Action failed."
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <dialog
            ref={dialogRef}
            onClick={e => {
                if (e.target === dialogRef.current) onClose();
            }}
            className="craft-modal-pop m-auto flex w-full max-w-2xl max-h-[85vh] flex-col border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex"
        >
            <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
                    Trade Detail
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[rgba(200,168,75,0.5)] hover:text-[#c8a84b]"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
                {!trade ? (
                    <div className="flex h-32 items-center justify-center">
                        {error ? (
                            <p className="text-sm text-red-400">{error}</p>
                        ) : (
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
                        )}
                    </div>
                ) : (
                    <>
                        {/* Status */}
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-[rgba(200,168,75,0.50)]">
                                    Status
                                </span>
                                <span className="text-[10px] text-[rgba(200,168,75,0.35)]">
                                    Last activity{" "}
                                    {new Date(
                                        trade.updatedAt
                                    ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit"
                                    })}
                                </span>
                            </div>
                            <span
                                className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${STATUS_BADGE[trade.status]?.cls ?? ""} ${STATUS_BADGE[trade.status]?.pulse ? "trade-status-pending" : ""}`}
                            >
                                {STATUS_BADGE[trade.status]?.label ??
                                    trade.status}
                            </span>
                        </div>

                        {/* Offers — each side is its own bordered panel with
                            a player identity chip up top (avatar + name,
                            "You" swapped in for whichever side is the
                            viewer), separated by a swap icon so the two
                            columns read as a clear negotiation, not just
                            two loose lists floating next to each other. */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                            <TradeOfferPanel
                                side={trade.initiator}
                                isMe={isInitiator}
                                offer={trade.initiator.offer}
                                highlighted={trade.proposedBy === "initiator"}
                                delay={0}
                            />
                            <div className="flex shrink-0 items-center justify-center py-1 sm:flex-col sm:py-0">
                                <div className="hidden h-full w-px bg-[rgba(200,168,75,0.15)] sm:block" />
                                <ArrowLeftRight className="mx-2 h-4 w-4 shrink-0 rotate-90 text-[rgba(200,168,75,0.35)] sm:rotate-0" />
                                <div className="hidden h-full w-px bg-[rgba(200,168,75,0.15)] sm:block" />
                            </div>
                            <TradeOfferPanel
                                side={trade.recipient}
                                isMe={isRecipient}
                                offer={trade.recipient.offer}
                                highlighted={trade.proposedBy === "recipient"}
                                delay={80}
                            />
                        </div>

                        {/* Who proposed the terms currently on the table —
                            gives the same signal the "Waiting for X" action
                            block does below, but visible immediately instead
                            of only once you scroll to the actions. */}
                        <p className="text-center text-[10px] text-[rgba(200,168,75,0.40)]">
                            {trade.proposedBy === "initiator"
                                ? trade.initiator.displayName
                                : trade.recipient.displayName}{" "}
                            set these terms
                        </p>

                        {error && (
                            <p className="flex items-center gap-1 text-xs text-red-400">
                                <AlertCircle className="h-3.5 w-3.5" /> {error}
                            </p>
                        )}

                        {/* Actions */}
                        {active && (
                            <div className="flex flex-col gap-2 border-t border-[rgba(200,168,75,0.12)] pt-4">
                                {myTurn ? (
                                    <>
                                        {/* [FIXED] Previously rendered for isRecipient ||
                        isInitiator unconditionally — the person who just
                        proposed/countered saw this same Accept button,
                        and clicking it always failed server-side
                        (waiting_on_other_side) with no explanation. Now
                        gated on myTurn, so Accept only ever appears when
                        clicking it will genuinely execute the trade. */}
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                act(() =>
                                                    acceptTrade(trade._id)
                                                )
                                            }
                                            className="flex items-center justify-center gap-2 h-9 border border-green-500/50 text-xs font-bold uppercase tracking-widest text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                                        >
                                            <CheckCircle className="h-3.5 w-3.5" />{" "}
                                            Accept — Complete Trade
                                        </button>
                                        {isRecipient && (
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() =>
                                                    act(() =>
                                                        declineTrade(trade._id)
                                                    )
                                                }
                                                className="flex items-center justify-center gap-2 h-9 border border-red-500/50 text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                                            >
                                                <XCircle className="h-3.5 w-3.5" />{" "}
                                                Decline
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    // The other party hasn't responded to MY current terms
                                    // yet — an Accept button here would only ever bounce
                                    // off the backend, so this replaces it with a plain
                                    // status line instead of a button that can't work.
                                    <div className="flex items-center gap-2 border border-[rgba(200,168,75,0.15)] bg-[rgba(200,168,75,0.03)] px-3 py-2 text-xs text-[rgba(200,168,75,0.6)]">
                                        <Clock className="h-3.5 w-3.5 shrink-0 text-[rgba(200,168,75,0.4)]" />
                                        Waiting for {otherPartyName} to respond
                                        to your terms.
                                    </div>
                                )}
                                {isInitiator && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            act(() => cancelTrade(trade._id))
                                        }
                                        className="h-9 border border-[rgba(200,168,75,0.25)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)] hover:border-[rgba(200,168,75,0.50)] hover:text-[#c8a84b] disabled:opacity-40"
                                    >
                                        Cancel Trade
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </dialog>
    );
}

// ── Propose trade modal ───────────────────────────────────────────
function ProposeModal({
    onClose,
    onRefresh
}: {
    onClose: () => void;
    onRefresh: () => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [step, setStep] = useState<"recipient" | "offer">("recipient");

    // recipient search
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PlayerSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [recipient, setRecipient] = useState<PlayerSearchResult | null>(null);

    // offer builder
    const [myCards, setMyCards] = useState<CardInstance[]>([]);
    const [cardsLoading, setCardsLoading] = useState(false);
    const [cardsPage, setCardsPage] = useState(1);
    const [cardsTotalPages, setCardsTotalPages] = useState(1);
    const [cardSearchInput, setCardSearchInput] = useState("");
    const [cardSearch, setCardSearch] = useState("");
    const [myMaterials, setMyMaterials] = useState<InventoryItem[]>([]);
    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [selectedMaterials, setSelectedMaterials] = useState<
        { itemId: string; quantity: number }[]
    >([]);
    const [currency, setCurrency] = useState<{
        type: TradeCurrency;
        amount: string;
    } | null>(null);
    const [recipientCurrency, setRecipientCurrency] = useState<{
        type: TradeCurrency;
        amount: string;
    } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        dialogRef.current?.showModal();
    }, []);

    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await searchPlayers(query);
                setResults(res.results);
            } catch {
                /* noop */
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        const t = setTimeout(() => setCardSearch(cardSearchInput), 350);
        return () => clearTimeout(t);
    }, [cardSearchInput]);

    // Cards refetch on search/page change — this runs whenever step is
    // "offer" (guarded below) rather than only once on entering the step,
    // since a player with hundreds of cards needs to page/search through
    // them, not just see whatever page 1 happened to hold when they
    // opened the offer builder.
    useEffect(() => {
        if (step !== "offer") return;
        let cancelled = false;
        setCardsLoading(true);
        getInventoryCards({
            sort: "rarity",
            page: cardsPage,
            q: cardSearch || undefined,
            listed: "false" // a listed card can't be offered in a trade either — same reasoning as the auction picker
        })
            .then(res => {
                if (cancelled) return;
                setMyCards(res.items);
                setCardsTotalPages(res.totalPages);
            })
            .catch(() => {
                /* noop — matches this file's existing silent-fail convention for background loads */
            })
            .finally(() => {
                if (!cancelled) setCardsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [step, cardsPage, cardSearch]);

    // Search resets to page 1 — a filtered result set has a different
    // totalPages than the unfiltered one.
    useEffect(() => {
        setCardsPage(1);
    }, [cardSearch]);

    const loadMaterials = async () => {
        try {
            const inv = await getInventory();
            setMyMaterials(inv.items.filter(i => i.category === "material"));
        } catch {
            /* noop */
        }
    };

    const goToOffer = () => {
        setStep("offer");
        loadMaterials();
    };

    const toggleCard = (id: string) => {
        setSelectedCards(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    // Materials are quantity-based (a player might own 12 of an item and
    // want to offer 3), not a plain toggle like cards — clamped to [0,
    // owned]. Setting to 0 removes the entry entirely rather than leaving
    // a zero-quantity row in selectedMaterials, since the trade payload
    // shouldn't carry offers of nothing.
    const setMaterialQuantity = (itemId: string, quantity: number) => {
        const owned = myMaterials.find(m => m.itemId === itemId)?.quantity ?? 0;
        const clamped = Math.max(0, Math.min(owned, quantity));
        setSelectedMaterials(prev => {
            const withoutThis = prev.filter(m => m.itemId !== itemId);
            return clamped > 0
                ? [...withoutThis, { itemId, quantity: clamped }]
                : withoutThis;
        });
    };

    // Mirrors trade.ts's isOfferEmpty(a) && isOfferEmpty(b) check —
    // empty only when BOTH sides have nothing. recipientCurrency is the
    // only thing this builder collects for "their" side (no card/material
    // request UI exists), so that's the full extent of theirOffer here.
    const bothOffersEmpty =
        selectedCards.length === 0 &&
        selectedMaterials.length === 0 &&
        !(currency && Number(currency.amount) > 0) &&
        !(recipientCurrency && Number(recipientCurrency.amount) > 0);

    const submit = async () => {
        if (!recipient) return;
        setSubmitting(true);
        setError("");
        try {
            const myOffer: Partial<TradeOffer> = {
                cardInstanceIds: selectedCards,
                materials: selectedMaterials,
                currency:
                    currency && Number(currency.amount) > 0
                        ? {
                              type: currency.type,
                              amount: Number(currency.amount)
                          }
                        : null
            };
            const theirOffer: Partial<TradeOffer> = {
                cardInstanceIds: [],
                materials: [],
                currency:
                    recipientCurrency && Number(recipientCurrency.amount) > 0
                        ? {
                              type: recipientCurrency.type,
                              amount: Number(recipientCurrency.amount)
                          }
                        : null
            };
            await proposeTrade({
                recipientUsername: recipient.username,
                initiatorOffer: myOffer,
                recipientOffer: theirOffer
            });
            onRefresh();
            onClose();
        } catch (err) {
            setError(
                err instanceof ApiResponseError
                    ? err.error.message
                    : "Failed to propose trade."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <dialog
            ref={dialogRef}
            onClick={e => {
                if (e.target === dialogRef.current) onClose();
            }}
            className="m-auto w-full max-w-lg border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col max-h-[90vh]"
        >
            <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
                    {step === "recipient"
                        ? "Propose Trade — Find Player"
                        : `Trade with ${recipient?.displayName}`}
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[rgba(200,168,75,0.5)] hover:text-[#c8a84b]"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
                {step === "recipient" ? (
                    <div className="flex flex-col gap-4">
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search username…"
                            className="form-input h-10 w-full border px-3 text-sm outline-none"
                        />
                        {searching && (
                            <p className="text-xs text-[rgba(200,168,75,0.40)]">
                                Searching…
                            </p>
                        )}
                        <div className="flex flex-col gap-1">
                            {results.map((r, i) => (
                                <button
                                    key={r.username}
                                    type="button"
                                    onClick={() => {
                                        setRecipient(r);
                                        setQuery(r.displayName);
                                        setResults([]);
                                    }}
                                    className="search-row-in flex items-center gap-3 border border-[rgba(200,168,75,0.15)] px-3 py-2 text-left transition-colors hover:border-[rgba(200,168,75,0.40)] hover:bg-[rgba(200,168,75,0.04)]"
                                    style={{
                                        animationDelay: `${Math.min(i, 8) * 30}ms`
                                    }}
                                >
                                    <div>
                                        <p className="text-sm font-bold text-[#f0e6c8]">
                                            {r.displayName}
                                        </p>
                                        <p className="text-xs text-[rgba(200,168,75,0.45)]">
                                            @{r.username}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* My cards */}
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                                    My Cards (select to offer)
                                </p>
                                <input
                                    type="text"
                                    value={cardSearchInput}
                                    onChange={e =>
                                        setCardSearchInput(e.target.value)
                                    }
                                    placeholder="Search…"
                                    className="form-input h-7 w-28 border px-2 text-[10px] outline-none"
                                />
                            </div>
                            {selectedCards.length > 0 && (
                                <p className="mb-1.5 text-[9px] text-[#c8a84b]">
                                    {selectedCards.length} card
                                    {selectedCards.length !== 1 ? "s" : ""}{" "}
                                    selected
                                    {cardsTotalPages > 1
                                        ? " (across pages)"
                                        : ""}
                                </p>
                            )}
                            {cardsLoading ? (
                                <div className="flex h-16 items-center justify-center text-[10px] text-[rgba(200,168,75,0.4)]">
                                    Loading…
                                </div>
                            ) : myCards.length === 0 ? (
                                <p className="py-3 text-center text-[10px] text-[rgba(200,168,75,0.4)]">
                                    {cardSearch
                                        ? "No cards match."
                                        : "No eligible cards."}
                                </p>
                            ) : (
                                <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                                    {myCards.map(c => {
                                        const ineligible = Boolean(
                                            c.isLocked ||
                                            c.pendingTradeId ||
                                            c.activeLoanId
                                        );
                                        const reason = c.isLocked
                                            ? "Locked"
                                            : c.pendingTradeId
                                              ? "In another trade"
                                              : c.activeLoanId
                                                ? "On loan"
                                                : undefined;
                                        return (
                                            <button
                                                key={c.instanceId}
                                                type="button"
                                                disabled={ineligible}
                                                title={reason}
                                                onClick={() =>
                                                    !ineligible &&
                                                    toggleCard(c.instanceId)
                                                }
                                                className={`relative overflow-hidden border text-left transition-all duration-150 ${
                                                    ineligible
                                                        ? "cursor-not-allowed border-[rgba(200,168,75,0.08)] opacity-40"
                                                        : selectedCards.includes(
                                                                c.instanceId
                                                            )
                                                          ? "scale-[1.03] border-[#c8a84b] ring-1 ring-[#c8a84b]/40 shadow-[0_0_10px_rgba(200,168,75,0.25)]"
                                                          : "border-[rgba(200,168,75,0.20)] hover:border-[rgba(200,168,75,0.40)]"
                                                }`}
                                            >
                                                <div className="flex h-16 items-center justify-center bg-[rgba(200,168,75,0.05)] text-xl">
                                                    {c.card?.mediaUrl ? (
                                                        <img
                                                            src={
                                                                c.card.mediaUrl
                                                            }
                                                            alt={c.card.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        "🃏"
                                                    )}
                                                </div>
                                                <p className="truncate px-1 py-0.5 text-[7px] text-[rgba(200,168,75,0.60)]">
                                                    {c.card?.name}
                                                </p>
                                                {ineligible && (
                                                    <span className="absolute left-0.5 top-0.5 rounded-sm bg-black/70 px-1 text-[6px] font-bold uppercase tracking-wide text-red-300">
                                                        {reason}
                                                    </span>
                                                )}
                                                {!ineligible &&
                                                    selectedCards.includes(
                                                        c.instanceId
                                                    ) && (
                                                        <div className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-[#c8a84b] text-[7px] font-bold text-black flex items-center justify-center">
                                                            ✓
                                                        </div>
                                                    )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {cardsTotalPages > 1 && (
                                <div className="mt-1.5 flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        disabled={cardsPage <= 1}
                                        onClick={() =>
                                            setCardsPage(p =>
                                                Math.max(1, p - 1)
                                            )
                                        }
                                        className="h-6 border border-[rgba(200,168,75,0.25)] px-2 text-[9px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                        Prev
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={cardsTotalPages}
                                        value={cardsPage}
                                        onChange={e => {
                                            const p = Math.min(
                                                cardsTotalPages,
                                                Math.max(
                                                    1,
                                                    Number(e.target.value) || 1
                                                )
                                            );
                                            setCardsPage(p);
                                        }}
                                        className="form-input h-6 w-10 border px-1 text-center text-[9px] outline-none"
                                    />
                                    <span className="text-[9px] text-[rgba(200,168,75,0.5)]">
                                        / {cardsTotalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={cardsPage >= cardsTotalPages}
                                        onClick={() =>
                                            setCardsPage(p =>
                                                Math.min(cardsTotalPages, p + 1)
                                            )
                                        }
                                        className="h-6 border border-[rgba(200,168,75,0.25)] px-2 text-[9px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* My materials */}
                        {myMaterials.length > 0 && (
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                                    My Materials (optional)
                                </p>
                                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                                    {myMaterials.map(m => {
                                        const entry = selectedMaterials.find(
                                            s => s.itemId === m.itemId
                                        );
                                        const qty = entry?.quantity ?? 0;
                                        return (
                                            <div
                                                key={m.itemId}
                                                className={`flex items-center gap-2 border px-2 py-1.5 text-xs transition-colors ${
                                                    qty > 0
                                                        ? "border-[#c8a84b] bg-[rgba(200,168,75,0.06)]"
                                                        : "border-[rgba(200,168,75,0.15)]"
                                                }`}
                                            >
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                                    {m.webappImage ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={m.webappImage}
                                                            alt={m.name}
                                                            className="h-full w-full object-contain"
                                                        />
                                                    ) : (
                                                        <span className="text-base leading-none">
                                                            {m.emoji}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="flex-1 truncate text-[rgba(200,168,75,0.75)]">
                                                    {m.name}
                                                </span>
                                                <span className="text-[9px] text-[rgba(200,168,75,0.4)]">
                                                    own {m.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={qty <= 0}
                                                    onClick={() =>
                                                        setMaterialQuantity(
                                                            m.itemId,
                                                            qty - 1
                                                        )
                                                    }
                                                    className="h-5 w-5 border border-[rgba(200,168,75,0.25)] text-[10px] text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={m.quantity}
                                                    value={qty}
                                                    onChange={e =>
                                                        setMaterialQuantity(
                                                            m.itemId,
                                                            Number(
                                                                e.target.value
                                                            ) || 0
                                                        )
                                                    }
                                                    className="form-input h-5 w-10 border px-1 text-center text-[10px] outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={qty >= m.quantity}
                                                    onClick={() =>
                                                        setMaterialQuantity(
                                                            m.itemId,
                                                            qty + 1
                                                        )
                                                    }
                                                    className="h-5 w-5 border border-[rgba(200,168,75,0.25)] text-[10px] text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Currency I offer */}
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                                I Offer Currency (optional)
                            </p>
                            <div className="flex items-center gap-2">
                                <select
                                    value={currency?.type ?? "ryo"}
                                    onChange={e =>
                                        setCurrency(prev => ({
                                            type: e.target
                                                .value as TradeCurrency,
                                            amount: prev?.amount ?? ""
                                        }))
                                    }
                                    className="form-input h-9 border px-2 text-xs outline-none"
                                >
                                    <option value="ryo">Ryo</option>
                                    <option value="kitsu">Kitsu</option>
                                </select>
                                <input
                                    type="number"
                                    min={0}
                                    value={currency?.amount ?? ""}
                                    onChange={e =>
                                        setCurrency({
                                            type: currency?.type ?? "ryo",
                                            amount: e.target.value
                                        })
                                    }
                                    placeholder="Amount"
                                    className="form-input h-9 flex-1 border px-3 text-sm outline-none"
                                />
                                {currency && (
                                    <button
                                        type="button"
                                        onClick={() => setCurrency(null)}
                                        className="text-[rgba(200,168,75,0.45)] hover:text-[#c8a84b]"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Currency I want */}
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                                I Want Currency (optional)
                            </p>
                            <div className="flex items-center gap-2">
                                <select
                                    value={recipientCurrency?.type ?? "ryo"}
                                    onChange={e =>
                                        setRecipientCurrency(prev => ({
                                            type: e.target
                                                .value as TradeCurrency,
                                            amount: prev?.amount ?? ""
                                        }))
                                    }
                                    className="form-input h-9 border px-2 text-xs outline-none"
                                >
                                    <option value="ryo">Ryo</option>
                                    <option value="kitsu">Kitsu</option>
                                </select>
                                <input
                                    type="number"
                                    min={0}
                                    value={recipientCurrency?.amount ?? ""}
                                    onChange={e =>
                                        setRecipientCurrency({
                                            type:
                                                recipientCurrency?.type ??
                                                "ryo",
                                            amount: e.target.value
                                        })
                                    }
                                    placeholder="Amount"
                                    className="form-input h-9 flex-1 border px-3 text-sm outline-none"
                                />
                                {recipientCurrency && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setRecipientCurrency(null)
                                        }
                                        className="text-[rgba(200,168,75,0.45)] hover:text-[#c8a84b]"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {error && (
                            <p className="flex items-center gap-1 text-xs text-red-400">
                                <AlertCircle className="h-3.5 w-3.5" /> {error}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {step === "offer" && (
                <OfferSummaryBar
                    cardCount={selectedCards.length}
                    materialCount={selectedMaterials.reduce(
                        (sum, m) => sum + m.quantity,
                        0
                    )}
                    myCurrency={
                        currency && Number(currency.amount) > 0
                            ? currency
                            : null
                    }
                    theirCurrency={
                        recipientCurrency &&
                        Number(recipientCurrency.amount) > 0
                            ? recipientCurrency
                            : null
                    }
                />
            )}

            <div className="flex gap-2 border-t border-[rgba(200,168,75,0.15)] px-5 py-4">
                {step === "recipient" ? (
                    <button
                        type="button"
                        disabled={!recipient}
                        onClick={goToOffer}
                        className="flex-1 h-10 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Next: Set Offer →
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => setStep("recipient")}
                            className="h-10 border border-[rgba(200,168,75,0.30)] px-4 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] hover:text-[#c8a84b]"
                        >
                            ← Back
                        </button>
                        <button
                            type="button"
                            disabled={submitting || bothOffersEmpty}
                            onClick={submit}
                            title={
                                bothOffersEmpty
                                    ? "At least one side needs to offer something"
                                    : undefined
                            }
                            className="flex-1 h-10 border border-[#c8a84b] bg-[#c8a84b] text-xs font-bold uppercase tracking-widest text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {submitting
                                ? "Sending…"
                                : bothOffersEmpty
                                  ? "Add Something to Offer"
                                  : "Send Proposal"}
                        </button>
                    </>
                )}
            </div>
        </dialog>
    );
}

// ── Live offer summary bar ────────────────────────────────────────
//
// Sits between the offer-builder body and the footer, visible the whole
// time step === "offer". Mirrors trade.ts's isOfferEmpty check
// client-side (empty only if BOTH sides have nothing — a one-sided
// "gift via trade" is legitimate and shouldn't be blocked) so the submit
// button's disabled state and the summary text always agree with what
// the backend will actually accept, rather than the player discovering
// the empty_trade rejection only after a round-trip.
function OfferSummaryBar({
    cardCount,
    materialCount,
    myCurrency,
    theirCurrency
}: {
    cardCount: number;
    materialCount: number;
    myCurrency: { type: TradeCurrency; amount: string } | null;
    theirCurrency: { type: TradeCurrency; amount: string } | null;
}) {
    const myOfferEmpty = cardCount === 0 && materialCount === 0 && !myCurrency;
    const theirOfferEmpty = !theirCurrency; // recipient's card/material offer isn't collected in this builder — see theirOffer in submit()
    const bothEmpty = myOfferEmpty && theirOfferEmpty;

    const parts: string[] = [];
    if (cardCount > 0)
        parts.push(`${cardCount} card${cardCount !== 1 ? "s" : ""}`);
    if (materialCount > 0)
        parts.push(
            `${materialCount} material${materialCount !== 1 ? "s" : ""}`
        );
    if (myCurrency)
        parts.push(
            `${Number(myCurrency.amount).toLocaleString()} ${myCurrency.type === "ryo" ? "両" : "kitsu"}`
        );

    return (
        <div
            className={`flex items-center gap-2 border-t px-5 py-2.5 text-[11px] transition-colors ${
                bothEmpty
                    ? "border-red-500/20 bg-red-500/[0.04] text-red-300/80"
                    : "border-[rgba(200,168,75,0.15)] bg-[rgba(200,168,75,0.03)] text-[rgba(200,168,75,0.65)]"
            }`}
        >
            {bothEmpty ? (
                <>
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                        Your offer is empty — add a card, material, or currency.
                    </span>
                </>
            ) : (
                <>
                    <Gift className="h-3.5 w-3.5 shrink-0 text-[#c8a84b]" />
                    <span>
                        You offer:{" "}
                        <span className="font-semibold text-[#f0e6c8]">
                            {parts.length > 0 ? parts.join(", ") : "nothing"}
                        </span>
                        {theirCurrency && (
                            <>
                                {" "}
                                · Requesting:{" "}
                                <span className="font-semibold text-[#f0e6c8]">
                                    {Number(
                                        theirCurrency.amount
                                    ).toLocaleString()}{" "}
                                    {theirCurrency.type === "ryo"
                                        ? "両"
                                        : "kitsu"}
                                </span>
                            </>
                        )}
                    </span>
                </>
            )}
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────
export default function TradePage() {
    const router = useRouter();
    // Supports deep-linking a specific trade via /trade?open=<id> — used
    // by the dashboard's pending-trade-offer notification so "Review"
    // opens straight into that trade's detail dialog instead of just
    // landing on the list and making the player find it themselves.
    const searchParams = useSearchParams();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(
        searchParams.get("open")
    );
    const [proposing, setProposing] = useState(false);
    // FIX: was myJid, a state that was never actually set anywhere in
    // this file — see TradeDetailModal's comment above. TradeSide (and
    // MeResponse) has no jid the frontend can compare against; username
    // is what's actually available from getMe() and reliable for "me"
    // specifically.
    const [myUsername, setMyUsername] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [meRes, tradesRes] = await Promise.all([
                getMe(),
                getTrades()
            ]);
            setMyUsername(meRes.username);
            setTrades(tradesRes.trades);
        } catch (err) {
            if (err instanceof ApiResponseError && err.status === 401) {
                router.push("/login");
                return;
            }
            setError("Couldn't load trades.");
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        load();
    }, [load]);

    const active = trades.filter(
        t => t.status === "pending" || t.status === "countered"
    );
    const history = trades.filter(
        t => !["pending", "countered"].includes(t.status)
    );

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

    return (
        <>
            <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between [animation:shop-card-in_0.3s_ease-out_backwards]">
                    <div className="section-header">
                        <span className="section-header-text">Trade</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setProposing(true)}
                        className="flex items-center gap-1.5 border border-[#c8a84b] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-all hover:bg-[#c8a84b] hover:text-black hover:shadow-[0_0_14px_rgba(200,168,75,0.3)] active:scale-95"
                    >
                        <Plus className="h-3.5 w-3.5" /> New Trade
                    </button>
                </div>

                <hr className="gold-rule" />

                {error && <p className="text-sm text-red-400">{error}</p>}

                {/* Active */}
                <div className="[animation:shop-card-in_0.3s_ease-out_0.05s_backwards]">
                    <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
                        Active ({active.length})
                    </h2>
                    {active.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 border border-dashed border-[rgba(200,168,75,0.15)] py-10 text-center">
                            <ArrowLeftRight className="h-5 w-5 text-[rgba(200,168,75,0.25)]" />
                            <p className="text-sm text-[rgba(200,168,75,0.40)]">
                                No active trades.
                            </p>
                        </div>
                    ) : (
                        <div className="form-card border">
                            {active.map((t, i) => (
                                <TradeRow
                                    key={t._id}
                                    trade={t}
                                    myUsername={myUsername}
                                    index={i}
                                    onSelect={() => setSelectedId(t._id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* History */}
                {history.length > 0 && (
                    <>
                        <hr className="gold-rule" />
                        <div className="[animation:shop-card-in_0.3s_ease-out_0.1s_backwards]">
                            <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
                                History
                            </h2>
                            <div className="form-card border">
                                {history.map((t, i) => (
                                    <TradeRow
                                        key={t._id}
                                        trade={t}
                                        myUsername={myUsername}
                                        index={i}
                                        onSelect={() => setSelectedId(t._id)}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </section>

            {selectedId && (
                <TradeDetailModal
                    tradeId={selectedId}
                    myUsername={myUsername}
                    onClose={() => setSelectedId(null)}
                    onRefresh={load}
                />
            )}

            {proposing && (
                <ProposeModal
                    onClose={() => setProposing(false)}
                    onRefresh={load}
                />
            )}
        </>
    );
}
