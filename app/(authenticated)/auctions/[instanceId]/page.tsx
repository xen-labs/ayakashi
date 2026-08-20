"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    Clock,
    Users,
    Zap,
    Gavel,
    Send,
    X,
    TrendingUp,
    Crown,
    ShieldAlert
} from "lucide-react";
import {
    getAuctionDetail,
    placeAuctionBid,
    cancelAuction,
    sendAuctionChat,
    auctionStreamUrl,
    ApiResponseError,
    type AuctionDetail,
    type AuctionBidHistoryEntry
} from "../../../../lib/api";
import { useCurrency } from "../../../components/CurrencyContext";
import { CurrencyIcon } from "../../../components/CurrencyIcon";

const RARITY_COLORS: Record<string, string> = {
    C: "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.5)]",
    R: "border-[rgba(120,200,150,0.35)] text-[#7fd39c]",
    SR: "border-[rgba(90,160,230,0.4)] text-[#6fb2f0]",
    SSR: "border-[rgba(190,110,230,0.45)] text-[#c98af0]",
    UR: "border-[rgba(230,180,60,0.55)] text-[#f0c445]"
};

function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
}

function initials(name: string): string {
    return name.slice(0, 1).toUpperCase();
}

// ── Full-bleed card media — no forced background, no crop box ──────
// Same pattern as the marketplace detail page's CardMedia: renders at
// its own natural aspect ratio inside a max-height constraint, with
// object-contain (not object-cover) so nothing gets cropped and no
// bg-black matte shows through the card's alpha-channel edges.
//
// Card-back placeholder — see CardTile.tsx for the full reasoning.
// Each JSX usage gets its own component instance/state, so this single
// definition covers both call sites below (hero, buy-modal thumbnail).
function AuctionCardMedia({
    card,
    isVideo,
    className = ""
}: {
    card: AuctionDetail["card"];
    isVideo: boolean;
    className?: string;
}) {
    const [artLoaded, setArtLoaded] = useState(false);

    if (!card) {
        return (
            <div
                className={`flex items-center justify-center text-[rgba(200,168,75,0.25)] ${className}`}
            >
                <Gavel className="h-10 w-10" />
            </div>
        );
    }
    return (
        <div className={`relative aspect-[3/4] ${className}`}>
            <img
                src="/cardback/cardback-neutral.webp"
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 z-0 h-full w-full object-contain transition-opacity duration-300 ${
                    artLoaded ? "opacity-0" : "opacity-100"
                }`}
            />
            {isVideo ? (
                <video
                    src={card.mediaUrl}
                    className={`relative z-[1] h-full w-full object-contain transition-opacity duration-300 ${
                        artLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedData={() => setArtLoaded(true)}
                />
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={card.mediaUrl}
                    alt={card.name}
                    className={`relative z-[1] h-full w-full object-contain transition-opacity duration-300 ${
                        artLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    onLoad={() => setArtLoaded(true)}
                    ref={img => {
                        if (img?.complete) setArtLoaded(true);
                    }}
                />
            )}
        </div>
    );
}

function fmtTime(ms: number) {
    return new Date(ms).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
}

// ── Live countdown, same logic as the browse grid's, duplicated
// locally rather than shared since this page needs the raw remainingMs
// too (for the "ended" transition), not just a formatted label.
function useCountdown(expiresAt: string | undefined) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    if (!expiresAt)
        return { label: "—", urgent: false, done: false, remainingMs: 0 };
    const remainingMs = new Date(expiresAt).getTime() - now;
    if (remainingMs <= 0)
        return { label: "Ended", urgent: false, done: true, remainingMs: 0 };

    const totalSec = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    let label: string;
    if (days > 0) label = `${days}d ${hours}h ${minutes}m`;
    else if (hours > 0) label = `${hours}h ${minutes}m ${seconds}s`;
    else label = `${minutes}:${String(seconds).padStart(2, "0")}`;

    return {
        label,
        urgent: remainingMs < 5 * 60_000,
        done: false,
        remainingMs
    };
}

// ── Bid history row — newest at bottom, winning bid highlighted gold.
function BidRow({
    bid,
    index,
    isLatest
}: {
    bid: AuctionBidHistoryEntry;
    index: number;
    isLatest: boolean;
}) {
    return (
        <div
            className={`auction-bid-in flex items-center gap-2.5 border-b border-[rgba(200,168,75,0.08)] py-2 last:border-0 ${
                bid.won ? "rounded-sm bg-[rgba(200,168,75,0.06)] px-2" : ""
            }`}
            style={{
                animationDelay: isLatest
                    ? "0ms"
                    : `${Math.min(index, 8) * 25}ms`
            }}
        >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(200,168,75,0.12)] text-[10px] font-bold text-[rgba(200,168,75,0.7)]">
                {initials(bid.bidderName)}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#f0e6c8]">
                    {bid.bidderName}
                    {bid.won && (
                        <Crown className="ml-1 inline-block h-3 w-3 -translate-y-0.5 text-[#f0c445]" />
                    )}
                </p>
                <p className="text-[9px] text-[rgba(200,168,75,0.35)]">
                    {fmtTime(new Date(bid.createdAt).getTime())}
                </p>
            </div>
            <p className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#e6c96a]">
                <CurrencyIcon type="kitsu" size={11} />
                {formatNumber(bid.amount)}
            </p>
        </div>
    );
}

interface ChatMsg {
    jid: string;
    name: string;
    text: string;
    at: number;
}

type EndedInfo =
    | { reason: "lapsed_no_bids" }
    | { reason: "settlement_failed" }
    | {
          reason: "buy_now" | "expired_sold";
          winnerJid: string;
          winnerName: string;
          finalPrice: number;
      };

export default function AuctionDetailPage() {
    const params = useParams<{ instanceId: string }>();
    const instanceId = params.instanceId;
    const router = useRouter();
    const { kitsu, refresh } = useCurrency();

    const [detail, setDetail] = useState<AuctionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [bidAmount, setBidAmount] = useState("");
    const [placingBid, setPlacingBid] = useState(false);
    const [bidError, setBidError] = useState("");
    const [priceFlash, setPriceFlash] = useState(false);
    const [outbidToast, setOutbidToast] = useState(false);
    const [ended, setEnded] = useState<EndedInfo | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [buyNowConfirm, setBuyNowConfirm] = useState(false);

    const [chat, setChat] = useState<ChatMsg[]>([]);
    const [chatText, setChatText] = useState("");
    const [sendingChat, setSendingChat] = useState(false);
    const [connected, setConnected] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const evtSourceRef = useRef<EventSource | null>(null);

    const countdown = useCountdown(detail?.expiresAt);

    // ── Initial load ──────────────────────────────────────────────
    const loadDetail = useCallback(async () => {
        try {
            const res = await getAuctionDetail(instanceId);
            setDetail(res);
            setLoadError("");
        } catch (err) {
            if (err instanceof ApiResponseError && err.status === 401) {
                router.push("/login");
                return;
            }
            setLoadError(
                err instanceof ApiResponseError
                    ? (err.error.message ?? "This auction couldn't be loaded.")
                    : "This auction couldn't be loaded."
            );
        } finally {
            setLoading(false);
        }
    }, [instanceId, router]);

    useEffect(() => {
        loadDetail();
    }, [loadDetail]);

    // ── SSE live feed — bids, chat, ended events ────────────────────
    useEffect(() => {
        const es = new EventSource(auctionStreamUrl(instanceId), {
            withCredentials: true
        });
        evtSourceRef.current = es;

        es.onopen = () => setConnected(true);
        es.onerror = () => setConnected(false);

        es.addEventListener("bid", e => {
            const data = JSON.parse((e as MessageEvent).data) as {
                bidderJid: string;
                bidderName: string;
                amount: number;
                wonByBuyNow: boolean;
            };
            setDetail(prev => {
                if (!prev) return prev;
                const wasMe = prev.isHighestBidder;
                const gotOutbid =
                    wasMe && data.bidderJid !== prev.highestBidderId;
                if (gotOutbid) {
                    setOutbidToast(true);
                    setTimeout(() => setOutbidToast(false), 3200);
                }
                return {
                    ...prev,
                    currentBid: data.amount,
                    bidCount: prev.bidCount + 1,
                    highestBidderId: data.bidderJid,
                    highestBidderName: data.bidderName,
                    isHighestBidder: false, // recomputed below if it's actually us
                    bids: [
                        {
                            bidderJid: data.bidderJid,
                            bidderName: data.bidderName,
                            amount: data.amount,
                            won: data.wonByBuyNow,
                            createdAt: new Date().toISOString()
                        },
                        ...prev.bids
                    ]
                };
            });
            setPriceFlash(true);
            setTimeout(() => setPriceFlash(false), 650);
        });

        es.addEventListener("ended", e => {
            const data = JSON.parse((e as MessageEvent).data) as EndedInfo;
            setEnded(data);
            refresh();
        });

        es.addEventListener("cancelled", () => {
            setEnded({ reason: "lapsed_no_bids" });
        });

        es.addEventListener("chat", e => {
            const data = JSON.parse((e as MessageEvent).data) as ChatMsg;
            setChat(prev => [...prev.slice(-49), data]);
        });

        return () => {
            es.close();
            evtSourceRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end"
        });
    }, [chat.length]);

    // ── Bidding ───────────────────────────────────────────────────
    const minBid = detail ? detail.currentBid + detail.bidIncrement : 0;

    const handlePlaceBid = async (amount: number) => {
        if (!detail) return;
        setPlacingBid(true);
        setBidError("");
        try {
            const res = await placeAuctionBid(instanceId, amount);
            setDetail(prev =>
                prev
                    ? {
                          ...prev,
                          currentBid: res.amount,
                          isHighestBidder: true,
                          highestBidderName: "You"
                      }
                    : prev
            );
            setBidAmount("");
            refresh();
            if (res.wonByBuyNow) {
                setEnded({
                    reason: "buy_now",
                    winnerJid: "me",
                    winnerName: "You",
                    finalPrice: res.amount
                });
            }
        } catch (err) {
            setBidError(
                err instanceof ApiResponseError
                    ? (err.error.message ?? "Couldn't place that bid.")
                    : "Couldn't place that bid."
            );
        } finally {
            setPlacingBid(false);
            setBuyNowConfirm(false);
        }
    };

    const handleQuickBid = () => {
        const n = parseInt(bidAmount, 10);
        if (!Number.isInteger(n) || n < minBid) {
            setBidError(`Minimum bid is ${formatNumber(minBid)} Kitsu.`);
            return;
        }
        handlePlaceBid(n);
    };

    const handleCancel = async () => {
        setCancelling(true);
        try {
            await cancelAuction(instanceId);
            router.push("/auctions");
        } catch (err) {
            setBidError(
                err instanceof ApiResponseError
                    ? (err.error.message ?? "Couldn't cancel this auction.")
                    : "Couldn't cancel this auction."
            );
            setCancelling(false);
        }
    };

    const handleSendChat = async () => {
        const text = chatText.trim();
        if (!text || sendingChat) return;
        setSendingChat(true);
        setChatText("");
        try {
            await sendAuctionChat(instanceId, text);
        } catch {
            // message just won't appear — not worth a blocking error here
        } finally {
            setSendingChat(false);
        }
    };

    // ── Loading / error states ───────────────────────────────────
    if (loading) {
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
    }

    if (loadError || !detail) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
                <ShieldAlert className="h-8 w-8 text-[rgba(200,168,75,0.4)]" />
                <p className="text-sm text-[rgba(200,168,75,0.5)]">
                    {loadError || "This auction couldn't be loaded."}
                </p>
                <button
                    type="button"
                    onClick={() => router.push("/auctions")}
                    className="h-10 border border-[#c8a84b] px-6 text-xs font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black"
                >
                    Back to Auction House
                </button>
            </div>
        );
    }

    const card = detail.card;
    const rarityClass = card ? RARITY_COLORS[card.rarity] : RARITY_COLORS.C;
    const isVideo = card?.mediaType === "video";
    const canAfford = kitsu === null || kitsu >= minBid;
    const canBid = !detail.isMine && !countdown.done && !ended;
    const recentBids = detail.bids.slice(0, 30);
    // Only bidders get the sticky mobile bar (canBid gates it below), so
    // only they need the extra bottom clearance for it — a seller's own
    // auction now shows BidPanel in-flow instead (see the mobile block
    // right after the chat panel), which needs normal padding, not an
    // 11rem gap left over for a bar that isn't rendering for them.
    const mobileBottomPad = canBid
        ? "pb-[calc(var(--bottom-nav-h,64px)+11rem)]"
        : "pb-[calc(var(--bottom-nav-h,64px)+2rem)]";

    return (
        <section
            className={`mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 ${mobileBottomPad} sm:px-6 lg:px-8 lg:pb-8`}
        >
            <button
                type="button"
                onClick={() => router.push("/auctions")}
                className="flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Auction House
            </button>

            {/* ── Outbid toast ── */}
            {outbidToast && (
                <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 [animation:shop-toast-in_0.3s_ease-out]">
                    <div className="auction-outbid-shake flex items-center gap-2 rounded-sm border border-red-500/40 bg-[#1a0500]/95 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                        <TrendingUp className="h-4 w-4 text-red-400" />
                        <p className="text-xs font-semibold text-red-300">
                            You&apos;ve been outbid! New leader:{" "}
                            <span className="text-red-200">
                                {detail.highestBidderName}
                            </span>
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                {/* ═══ Left column — card art, bid panel, history ═══ */}
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-5">
                        {/* ── Card media — full size, no crop box, no black matte ── */}
                        <div className="flex justify-center sm:justify-start">
                            <div className="max-h-[46vh] max-w-full">
                                <AuctionCardMedia
                                    card={card}
                                    isVideo={isVideo}
                                    className="max-h-[46vh] rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                            <span
                                className={`inline-block w-fit rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${rarityClass}`}
                            >
                                {card?.rarity}
                            </span>
                            <h1 className="font-display text-xl font-bold leading-tight text-[#f0e6c8]">
                                {card?.name ?? "Unknown Card"}
                            </h1>
                            <p className="text-sm text-[rgba(200,168,75,0.55)]">
                                {card?.seriesName}
                            </p>

                            <div className="mt-1 flex items-center gap-2 text-xs text-[rgba(200,168,75,0.45)]">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(200,168,75,0.12)] text-[9px] font-bold text-[rgba(200,168,75,0.7)]">
                                    {initials(detail.sellerName)}
                                </div>
                                Sold by{" "}
                                <span className="font-semibold text-[rgba(200,168,75,0.7)]">
                                    {detail.isMine ? "You" : detail.sellerName}
                                </span>
                            </div>

                            {/* Countdown */}
                            <div
                                className={`mt-2 flex w-fit items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                                    countdown.done
                                        ? "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.35)]"
                                        : countdown.urgent
                                          ? "auction-countdown-urgent border-red-500/40 text-red-300"
                                          : "border-[rgba(200,168,75,0.25)] text-[#e6c96a]"
                                }`}
                            >
                                <Clock className="h-3.5 w-3.5" />
                                {countdown.done
                                    ? "Auction Ended"
                                    : countdown.label}
                            </div>
                        </div>
                    </div>

                    {/* ── Ended banner ── */}
                    {ended && (
                        <div className="reveal-pop flex flex-col items-center gap-2 rounded-md border border-[#c8a84b]/40 bg-[rgba(200,168,75,0.06)] px-5 py-6 text-center">
                            {ended.reason === "lapsed_no_bids" ? (
                                <>
                                    <Gavel className="h-6 w-6 text-[rgba(200,168,75,0.5)]" />
                                    <p className="text-sm font-bold text-[#e6c96a]">
                                        Auction ended with no bids
                                    </p>
                                    <p className="text-xs text-[rgba(200,168,75,0.45)]">
                                        The card was returned to the seller.
                                    </p>
                                </>
                            ) : ended.reason === "settlement_failed" ? (
                                <>
                                    <ShieldAlert className="h-6 w-6 text-red-400" />
                                    <p className="text-sm font-bold text-red-300">
                                        Something went wrong settling this
                                        auction
                                    </p>
                                    <p className="text-xs text-[rgba(200,168,75,0.45)]">
                                        The seller has been notified — please
                                        check back.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <Crown className="h-7 w-7 text-[#f0c445]" />
                                    <p className="text-sm font-bold text-[#e6c96a]">
                                        {ended.winnerName} won for{" "}
                                        <span className="inline-flex items-center gap-1">
                                            <CurrencyIcon
                                                type="kitsu"
                                                size={14}
                                            />
                                            {formatNumber(ended.finalPrice)}
                                        </span>
                                    </p>
                                    <p className="text-xs text-[rgba(200,168,75,0.45)]">
                                        {ended.reason === "buy_now"
                                            ? "Bought instantly"
                                            : "Auction closed"}
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Bid history ── */}
                    <div className="form-card rounded-md border px-4 py-4">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                                <Users className="h-3.5 w-3.5" />
                                Bid History ({detail.bidCount})
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${connected ? "auction-live-dot bg-green-400" : "bg-[rgba(200,168,75,0.3)]"}`}
                                />
                                {connected ? "Live" : "Reconnecting…"}
                            </span>
                        </div>
                        {recentBids.length === 0 ? (
                            <p className="py-6 text-center text-xs text-[rgba(200,168,75,0.4)]">
                                No bids yet — be the first.
                            </p>
                        ) : (
                            <div className="max-h-72 overflow-y-auto pr-1">
                                {recentBids.map((b, i) => (
                                    <BidRow
                                        key={`${b.bidderJid}-${b.createdAt}-${b.amount}`}
                                        bid={b}
                                        index={i}
                                        isLatest={i === 0}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ Right column — bid panel + chat (desktop) ═══ */}
                <div className="hidden flex-col gap-5 lg:flex">
                    <BidPanel
                        detail={detail}
                        countdown={countdown}
                        canBid={canBid}
                        canAfford={canAfford}
                        minBid={minBid}
                        bidAmount={bidAmount}
                        setBidAmount={setBidAmount}
                        placingBid={placingBid}
                        bidError={bidError}
                        priceFlash={priceFlash}
                        onQuickBid={handleQuickBid}
                        onBuyNow={() => setBuyNowConfirm(true)}
                        onCancel={handleCancel}
                        cancelling={cancelling}
                    />
                    <ChatPanel
                        chat={chat}
                        chatText={chatText}
                        setChatText={setChatText}
                        onSend={handleSendChat}
                        sending={sendingChat}
                        chatEndRef={chatEndRef}
                        ended={!!ended}
                    />
                </div>
            </div>

            {/* ═══ Mobile seller panel (own auction only) ═══
          Desktop gets this via BidPanel inside the hidden lg:flex right
          column above — but that whole column is desktop-only, so a
          seller viewing their own listing on mobile previously saw NO
          cancel option at all (canBid is false for detail.isMine, so
          the sticky bid bar below never renders for them either).
          Rendered in-flow, not sticky — a seller has no live bid
          controls to keep pinned, just a status line and (conditionally)
          a cancel button. */}
            {detail.isMine && (
                <div className="lg:hidden">
                    <BidPanel
                        detail={detail}
                        countdown={countdown}
                        canBid={canBid}
                        canAfford={canAfford}
                        minBid={minBid}
                        bidAmount={bidAmount}
                        setBidAmount={setBidAmount}
                        placingBid={placingBid}
                        bidError={bidError}
                        priceFlash={priceFlash}
                        onQuickBid={handleQuickBid}
                        onBuyNow={() => setBuyNowConfirm(true)}
                        onCancel={handleCancel}
                        cancelling={cancelling}
                    />
                </div>
            )}

            {/* ═══ Mobile chat (below the fold) ═══ */}
            <div className="lg:hidden">
                <ChatPanel
                    chat={chat}
                    chatText={chatText}
                    setChatText={setChatText}
                    onSend={handleSendChat}
                    sending={sendingChat}
                    chatEndRef={chatEndRef}
                    ended={!!ended}
                />
            </div>

            {/* ═══ Sticky mobile bid bar ═══
          Docks above BottomNav (fixed bottom-0 z-40) via --bottom-nav-h,
          with z-50 so it stacks above the nav instead of being clipped
          under it — this was the actual cause of the cut-off BID
          button and input in the screenshots. */}
            {canBid && (
                <div
                    className="auction-bidbar-in fixed inset-x-0 z-50 border-t border-[rgba(200,168,75,0.25)] bg-[#0d0c00]/97 px-4 pt-3 backdrop-blur-sm lg:hidden"
                    style={{
                        bottom: "var(--bottom-nav-h, 64px)",
                        paddingBottom:
                            "calc(0.75rem + env(safe-area-inset-bottom, 0px))"
                    }}
                >
                    <div className="mx-auto flex max-w-5xl items-center gap-2.5">
                        <div className="flex-1">
                            <p className="text-[9px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                                Current Bid
                            </p>
                            <p
                                className={`flex items-center gap-1 text-base font-bold text-[#e6c96a] ${priceFlash ? "auction-price-flash" : ""}`}
                            >
                                <CurrencyIcon type="kitsu" size={14} />
                                {formatNumber(detail.currentBid)}
                            </p>
                        </div>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={minBid}
                            value={bidAmount}
                            onChange={e => setBidAmount(e.target.value)}
                            placeholder={String(minBid)}
                            className="form-input h-10 w-24 border px-2 text-sm outline-none"
                        />
                        <button
                            type="button"
                            disabled={placingBid || !canAfford}
                            onClick={handleQuickBid}
                            className="brush-btn h-11 min-w-0 shrink-0 px-4 text-xs disabled:opacity-50"
                        >
                            {placingBid ? "…" : "Bid"}
                        </button>
                    </div>
                    {detail.buyNowPrice !== null && (
                        <button
                            type="button"
                            onClick={() => setBuyNowConfirm(true)}
                            className="auction-buynow-btn mt-2 flex h-9 w-full items-center justify-center gap-1.5 border border-[#f0c445]/50 bg-[rgba(240,196,69,0.1)] text-xs font-bold uppercase tracking-widest text-[#f0c445]"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            Buy Now — {formatNumber(detail.buyNowPrice)} Kitsu
                        </button>
                    )}
                    {bidError && (
                        <p className="mt-1.5 text-[10px] text-red-400">
                            {bidError}
                        </p>
                    )}
                </div>
            )}

            {/* ═══ Buy-now confirm modal ═══ */}
            {buyNowConfirm && detail.buyNowPrice !== null && (
                <BuyNowModal
                    card={card}
                    price={detail.buyNowPrice}
                    onClose={() => setBuyNowConfirm(false)}
                    onConfirm={() =>
                        handlePlaceBid(detail.buyNowPrice as number)
                    }
                    placing={placingBid}
                />
            )}
        </section>
    );
}

// ── Bid panel — desktop sidebar ─────────────────────────────────────
function BidPanel({
    detail,
    countdown,
    canBid,
    canAfford,
    minBid,
    bidAmount,
    setBidAmount,
    placingBid,
    bidError,
    priceFlash,
    onQuickBid,
    onBuyNow,
    onCancel,
    cancelling
}: {
    detail: AuctionDetail;
    countdown: { done: boolean };
    canBid: boolean;
    canAfford: boolean;
    minBid: number;
    bidAmount: string;
    setBidAmount: (v: string) => void;
    placingBid: boolean;
    bidError: string;
    priceFlash: boolean;
    onQuickBid: () => void;
    onBuyNow: () => void;
    onCancel: () => void;
    cancelling: boolean;
}) {
    const quickAdds = [
        minBid,
        minBid + detail.bidIncrement,
        minBid + detail.bidIncrement * 4
    ];

    return (
        <div className="auction-live-panel form-card flex flex-col gap-4 rounded-md border px-5 py-5">
            <div>
                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                    {detail.bidCount > 0 ? "Current Bid" : "Starting Bid"}
                </p>
                <p
                    className={`flex items-center gap-1.5 text-3xl font-bold text-[#e6c96a] ${priceFlash ? "auction-price-flash" : ""}`}
                >
                    <CurrencyIcon type="kitsu" size={26} />
                    {formatNumber(detail.currentBid)}
                </p>
                {detail.highestBidderName && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-[rgba(200,168,75,0.5)]">
                        <Crown className="h-3 w-3 text-[#f0c445]" />
                        {detail.isHighestBidder ? (
                            <span className="font-semibold text-[#7fd39c]">
                                You&apos;re winning!
                            </span>
                        ) : (
                            <>
                                Leading:{" "}
                                <span className="font-semibold text-[rgba(200,168,75,0.75)]">
                                    {detail.highestBidderName}
                                </span>
                            </>
                        )}
                    </p>
                )}
            </div>

            <hr className="border-t border-[rgba(200,168,75,0.12)]" />

            {detail.isMine ? (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-[rgba(200,168,75,0.5)]">
                        This is your auction.{" "}
                        {detail.bidCount > 0
                            ? "It already has bids and can't be cancelled."
                            : "You can cancel it since no bids have been placed yet."}
                    </p>
                    {detail.bidCount === 0 && !countdown.done && (
                        <button
                            type="button"
                            disabled={cancelling}
                            onClick={onCancel}
                            className="h-10 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                            {cancelling ? "Cancelling…" : "Cancel Auction"}
                        </button>
                    )}
                </div>
            ) : countdown.done ? (
                <p className="text-center text-xs text-[rgba(200,168,75,0.45)]">
                    This auction has ended.
                </p>
            ) : (
                <>
                    <div className="flex gap-1.5">
                        {quickAdds.map((amt, i) => (
                            <button
                                key={amt}
                                type="button"
                                onClick={() => setBidAmount(String(amt))}
                                className="flex-1 rounded-sm border border-[rgba(200,168,75,0.2)] py-1.5 text-[10px] font-bold text-[rgba(200,168,75,0.6)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b]"
                            >
                                {i === 0
                                    ? "Min"
                                    : `+${formatNumber(amt - minBid)}`}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 border border-[rgba(200,168,75,0.25)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
                        <CurrencyIcon type="kitsu" size={16} />
                        <input
                            type="number"
                            inputMode="numeric"
                            min={minBid}
                            value={bidAmount}
                            onChange={e => setBidAmount(e.target.value)}
                            placeholder={`${formatNumber(minBid)} min`}
                            className="w-full bg-transparent text-sm text-[#f0e6c8] outline-none"
                        />
                    </div>

                    {!canAfford && (
                        <p className="text-xs text-red-400">
                            You don&apos;t have enough spendable Kitsu.
                        </p>
                    )}
                    {bidError && (
                        <p className="text-xs text-red-400">{bidError}</p>
                    )}

                    <button
                        type="button"
                        disabled={placingBid || !canBid}
                        onClick={onQuickBid}
                        className="brush-btn brush-btn-glint h-12 w-full text-sm disabled:opacity-50"
                    >
                        {placingBid ? "Placing Bid…" : "Place Bid"}
                    </button>

                    {detail.buyNowPrice !== null && (
                        <button
                            type="button"
                            onClick={onBuyNow}
                            disabled={placingBid}
                            className="auction-buynow-btn flex h-11 w-full items-center justify-center gap-1.5 border border-[#f0c445]/50 bg-[rgba(240,196,69,0.08)] text-xs font-bold uppercase tracking-widest text-[#f0c445] transition-colors hover:bg-[rgba(240,196,69,0.15)] disabled:opacity-50"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            Buy Now — {formatNumber(detail.buyNowPrice)} Kitsu
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

// ── Buy-now confirmation modal ──────────────────────────────────────
function BuyNowModal({
    card,
    price,
    onClose,
    onConfirm,
    placing
}: {
    card: AuctionDetail["card"];
    price: number;
    onClose: () => void;
    onConfirm: () => void;
    placing: boolean;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const el = dialogRef.current;
        if (!el) return;
        el.showModal();
        const handler = () => onClose();
        el.addEventListener("cancel", handler);
        return () => el.removeEventListener("cancel", handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <dialog
            ref={dialogRef}
            onClick={e => {
                if (e.target === dialogRef.current && !placing) onClose();
            }}
            className="craft-modal-pop m-auto w-full max-w-sm flex-col border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex"
            aria-modal="true"
        >
            <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#f0c445]">
                    Confirm Buy Now
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="text-[rgba(200,168,75,0.5)] transition-colors hover:text-[#c8a84b]"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
                <div className="flex items-center gap-4">
                    <div className="h-24 w-20 shrink-0">
                        <AuctionCardMedia
                            card={card}
                            isVideo={card?.mediaType === "video"}
                            className="rounded-md"
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#f0e6c8]">
                            {card?.name}
                        </p>
                        <p className="truncate text-xs text-[rgba(200,168,75,0.5)]">
                            {card?.seriesName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-[rgba(200,168,75,0.12)] pt-4">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                        Instant Price
                    </span>
                    <span className="flex items-center gap-1.5 text-lg font-bold text-[#f0c445]">
                        <CurrencyIcon type="kitsu" size={18} />
                        {formatNumber(price)}
                    </span>
                </div>

                <button
                    type="button"
                    disabled={placing}
                    onClick={onConfirm}
                    className="auction-buynow-btn h-11 w-full border border-[#f0c445] bg-[#f0c445] text-sm font-bold uppercase tracking-widest text-black transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {placing
                        ? "Confirming…"
                        : `Buy Now for ${formatNumber(price)} Kitsu`}
                </button>
            </div>
        </dialog>
    );
}

// ── Live chat panel ──────────────────────────────────────────────────
function ChatPanel({
    chat,
    chatText,
    setChatText,
    onSend,
    sending,
    chatEndRef,
    ended
}: {
    chat: ChatMsg[];
    chatText: string;
    setChatText: (v: string) => void;
    onSend: () => void;
    sending: boolean;
    chatEndRef: React.RefObject<HTMLDivElement | null>;
    // Once the auction has settled/cancelled, the backend rejects new
    // chat posts (the route looks up an active "listing.type": "auction"
    // record, which no longer exists once settled — see
    // core/auctions.ts's markChatSettled callers). Disabling the input
    // here just turns that into a clear, immediate state instead of a
    // "this auction no longer exists" error surfacing after a failed
    // send. Read-only history from AuctionChatMessage still displays
    // fine above — this only affects composing new messages.
    ended: boolean;
}) {
    return (
        <div className="form-card flex h-80 flex-col rounded-md border">
            <div className="border-b border-[rgba(200,168,75,0.12)] px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                    Live Chat
                </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {chat.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[rgba(200,168,75,0.35)]">
                        No messages yet — say hi.
                    </p>
                ) : (
                    chat.map((m, i) => (
                        <div
                            key={`${m.jid}-${m.at}-${i}`}
                            className="auction-chat-in flex items-start gap-2"
                        >
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(200,168,75,0.12)] text-[8px] font-bold text-[rgba(200,168,75,0.7)]">
                                {initials(m.name)}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold text-[rgba(200,168,75,0.6)]">
                                    {m.name}{" "}
                                    <span className="font-normal text-[rgba(200,168,75,0.3)]">
                                        {fmtTime(m.at)}
                                    </span>
                                </p>
                                <p className="break-words text-xs text-[#f0e6c8]">
                                    {m.text}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-[rgba(200,168,75,0.12)] px-3 py-2.5">
                <input
                    type="text"
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !ended) onSend();
                    }}
                    maxLength={300}
                    disabled={ended}
                    placeholder={
                        ended ? "This auction has ended" : "Say something…"
                    }
                    className="form-input h-9 flex-1 border px-3 text-xs outline-none disabled:opacity-40"
                />
                <button
                    type="button"
                    disabled={ended || sending || !chatText.trim()}
                    onClick={onSend}
                    aria-label="Send"
                    className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#c8a84b] text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:opacity-40"
                >
                    <Send className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
