"use client";

// app/food-market/page.tsx
//
// The food market — DELIBERATELY NOT built like /marketplace. That page
// is a browsable listing feed because every CardInstance is a unique
// object worth picking between. Food items are fungible: your food_egg
// is identical to anyone else's, so there is no browse/buy-from-another-
// player surface here, and there never will be — see routes/
// foodMarket.ts's header for the full design reasoning. This page is a
// sell-into-a-pool flow instead: pick an item you own, pick a quantity,
// submit — it leaves your inventory immediately and settles at the next
// daily batch, at one price per item per day (see core/foodPricing.ts).
//
// Two tabs, same shape as marketplace's Browse/My Listings split, but
// with genuinely different content on each side:
//   "Sell"    — today's price for every sellable item + a quantity
//               picker, sourced from your own inventory (GET
//               /inventory, filtered to category:"food" — no separate
//               "my sellable food" endpoint needed, the data's already
//               there).
//   "My Orders" — your queued (pending) and recently-settled orders.
//
// Reuses the exact visual language already established by
// marketplace_page.tsx: .section-header, .gold-rule, .form-input,
// .form-card, .brush-btn, the gold-on-black RARITY_COLORS-adjacent
// palette. No new CSS needed — every class here already exists in
// globals.css.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock, CheckCircle2, ShoppingBasket, X } from "lucide-react";
import {
    getFoodMarketPrices,
    getMyFoodSellOrders,
    submitFoodSellOrder,
    getInventory,
    ApiResponseError
} from "../../../lib/api";
import type {
    FoodMarketPriceEntry,
    FoodSellOrderView,
    InventoryItem
} from "../../../lib/api";

function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    });
}

// ── Sell drawer — pick a quantity for one owned food item ────────────
// Same modal shape as marketplace's SellModal (dialog element, backdrop
// click to close, inline error, disabled-while-submitting button) but
// simpler content — one item is already chosen (the tile that was
// tapped), there's no card picker step, just a quantity + confirm.
function SellDrawer({
    item,
    price,
    onClose,
    onSold
}: {
    item: InventoryItem;
    price: number;
    onClose: () => void;
    onSold: () => void;
}) {
    const [quantity, setQuantity] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<{
        quantity: number;
        estimatedTotal: number;
    } | null>(null);

    const qtyNum = parseInt(quantity, 10);
    const validQty =
        Number.isInteger(qtyNum) && qtyNum >= 1 && qtyNum <= item.quantity;

    const handleSubmit = async () => {
        if (!validQty) {
            setError(`Enter a whole number between 1 and ${item.quantity}.`);
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            const res = await submitFoodSellOrder(item.itemId, qtyNum);
            setResult({
                quantity: res.quantity,
                estimatedTotal: res.estimatedTotal
            });
            onSold();
        } catch (err) {
            setError(
                err instanceof ApiResponseError
                    ? (err.error.message ?? "Couldn't queue this sale.")
                    : "Couldn't queue this sale."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <dialog
            open
            onClick={e => {
                if (e.target === e.currentTarget && !submitting) onClose();
            }}
            className="craft-modal-pop m-auto w-full max-w-md border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col"
            aria-modal="true"
        >
            <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
                    {result ? "Queued" : `Sell ${item.name}`}
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

            {result ? (
                <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
                    <div className="reveal-pop flex h-16 w-16 items-center justify-center rounded-full border border-[#c8a84b]/40 bg-[#c8a84b]/10">
                        <CheckCircle2 className="h-7 w-7 text-[#c8a84b]" />
                    </div>
                    <p className="font-display text-base font-bold text-[#e6c96a]">
                        Sale Queued
                    </p>
                    <p className="text-xs text-[rgba(200,168,75,0.5)]">
                        {result.quantity}x {item.name} will settle for an
                        estimated{" "}
                        <span className="font-bold text-[#e6c96a]">
                            {formatNumber(result.estimatedTotal)} ryo
                        </span>{" "}
                        at the next daily settlement.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="brush-btn w-40"
                    >
                        Done
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-4 px-5 py-5">
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-[rgba(200,168,75,0.15)] bg-[rgba(200,168,75,0.04)]">
                            {item.webappImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={item.webappImage}
                                    alt={item.name}
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <span className="text-2xl">{item.emoji}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#f0e6c8]">
                                {item.name}
                            </p>
                            <p className="text-xs text-[rgba(200,168,75,0.5)]">
                                You have{" "}
                                <span className="font-semibold text-[#e6c96a]">
                                    {formatNumber(item.quantity)}
                                </span>
                            </p>
                        </div>
                    </div>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                            Quantity to Sell
                        </span>
                        <div className="flex items-center gap-2 border border-[rgba(200,168,75,0.25)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
                            <input
                                type="number"
                                min={1}
                                max={item.quantity}
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                placeholder={`e.g. ${Math.min(10, item.quantity)}`}
                                className="w-full bg-transparent text-sm text-[#f0e6c8] outline-none"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setQuantity(String(item.quantity))
                                }
                                className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.5)] underline underline-offset-2 hover:text-[#c8a84b]"
                            >
                                Max
                            </button>
                        </div>
                    </label>

                    {validQty && (
                        <p className="text-xs text-[rgba(200,168,75,0.55)]">
                            Estimated payout:{" "}
                            <span className="font-bold text-[#e6c96a]">
                                {formatNumber(qtyNum * price)} ryo
                            </span>{" "}
                            ({formatNumber(price)}/ea — settles at the next
                            daily price, may shift slightly)
                        </p>
                    )}

                    {error && (
                        <p className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                            {error}
                        </p>
                    )}

                    <button
                        type="button"
                        disabled={submitting || !quantity}
                        onClick={handleSubmit}
                        className="h-11 w-full border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "Queuing…" : "Queue Sale"}
                    </button>
                </div>
            )}
        </dialog>
    );
}

// ── Sell tab — today's prices + your owned quantities ─────────────────
function SellGrid({
    prices,
    inventory,
    loading,
    search,
    onPick
}: {
    prices: FoodMarketPriceEntry[];
    inventory: Map<string, InventoryItem>;
    loading: boolean;
    search: string;
    onPick: (item: InventoryItem, price: number) => void;
}) {
    if (loading)
        return (
            <div className="flex min-h-[30vh] items-center justify-center">
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

    const q = search.trim().toLowerCase();
    const filtered = prices.filter(p => !q || p.name.toLowerCase().includes(q));

    if (filtered.length === 0)
        return (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
                <ShoppingBasket className="h-5 w-5 text-[rgba(200,168,75,0.25)]" />
                <p className="text-sm text-[rgba(200,168,75,0.40)]">
                    No items match &quot;{search}&quot;.
                </p>
            </div>
        );

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map(p => {
                const owned = inventory.get(p.itemId);
                const ownedQty = owned?.quantity ?? 0;
                const canSell = ownedQty > 0;
                return (
                    <button
                        key={p.itemId}
                        type="button"
                        disabled={!canSell}
                        onClick={() => owned && onPick(owned, p.price)}
                        className={`form-card flex flex-col items-center gap-2 overflow-hidden border p-3 text-center transition-colors ${
                            canSell
                                ? "hover:border-[#c8a84b]"
                                : "cursor-not-allowed opacity-40"
                        }`}
                    >
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden bg-[rgba(200,168,75,0.04)]">
                            {p.webappImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={p.webappImage}
                                    alt={p.name}
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <span className="text-2xl">{p.emoji}</span>
                            )}
                        </div>
                        <p className="truncate text-xs font-semibold text-[#f0e6c8]">
                            {p.name}
                        </p>
                        <p className="text-xs font-bold text-[#e6c96a]">
                            {formatNumber(p.price)} ryo/ea
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                            {canSell
                                ? `You have ${formatNumber(ownedQty)}`
                                : "None owned"}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}

// ── My Orders tab ──────────────────────────────────────────────────
function MyOrders({
    pending,
    recentSettled,
    loading
}: {
    pending: FoodSellOrderView[];
    recentSettled: FoodSellOrderView[];
    loading: boolean;
}) {
    if (loading)
        return (
            <p className="py-12 text-center text-xs text-[rgba(200,168,75,0.4)]">
                Loading your orders…
            </p>
        );

    if (pending.length === 0 && recentSettled.length === 0)
        return (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Clock className="h-5 w-5 text-[rgba(200,168,75,0.25)]" />
                <p className="text-sm text-[rgba(200,168,75,0.40)]">
                    You don&apos;t have any food market orders yet.
                </p>
            </div>
        );

    return (
        <div className="flex flex-col gap-6">
            {pending.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                        Pending — {pending.length}
                    </p>
                    <div className="flex flex-col gap-2">
                        {pending.map(o => (
                            <div
                                key={o.orderId}
                                className="form-card flex items-center justify-between gap-3 border px-3 py-2.5"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="text-lg">{o.emoji}</span>
                                    <div>
                                        <p className="text-xs font-semibold text-[#f0e6c8]">
                                            {formatNumber(o.quantity)}x {o.name}
                                        </p>
                                        <p className="text-[10px] text-[rgba(200,168,75,0.45)]">
                                            Queued {fmtDate(o.submittedAt)}
                                        </p>
                                    </div>
                                </div>
                                <span className="shrink-0 rounded-sm border border-[rgba(200,168,75,0.25)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                                    Awaiting settlement
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {recentSettled.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                        Recently Settled
                    </p>
                    <div className="flex flex-col gap-2">
                        {recentSettled.map(o => (
                            <div
                                key={o.orderId}
                                className="form-card flex items-center justify-between gap-3 border px-3 py-2.5"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="text-lg">{o.emoji}</span>
                                    <div>
                                        <p className="text-xs font-semibold text-[#f0e6c8]">
                                            {formatNumber(o.quantity)}x {o.name}
                                        </p>
                                        <p className="text-[10px] text-[rgba(200,168,75,0.45)]">
                                            {o.settledAt
                                                ? fmtDate(o.settledAt)
                                                : ""}
                                        </p>
                                    </div>
                                </div>
                                <span className="shrink-0 text-xs font-bold text-[#e6c96a]">
                                    +
                                    {formatNumber(
                                        (o.settledPrice ?? 0) * o.quantity
                                    )}{" "}
                                    ryo
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────
type Tab = "sell" | "orders";

export default function FoodMarket() {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("sell");

    const [prices, setPrices] = useState<FoodMarketPriceEntry[]>([]);
    const [inventory, setInventory] = useState<Map<string, InventoryItem>>(
        new Map()
    );
    const [loadingSell, setLoadingSell] = useState(true);
    const [search, setSearch] = useState("");

    const [pending, setPending] = useState<FoodSellOrderView[]>([]);
    const [recentSettled, setRecentSettled] = useState<FoodSellOrderView[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [sellTarget, setSellTarget] = useState<{
        item: InventoryItem;
        price: number;
    } | null>(null);

    const loadSell = useCallback(async () => {
        setLoadingSell(true);
        try {
            const [priceRes, invRes] = await Promise.all([
                getFoodMarketPrices(),
                getInventory()
            ]);
            setPrices(priceRes.prices);
            setInventory(
                new Map(
                    invRes.items
                        .filter(i => i.category === "food")
                        .map(i => [i.itemId, i])
                )
            );
        } catch (err) {
            if (err instanceof ApiResponseError && err.status === 401) {
                router.push("/login");
            }
        } finally {
            setLoadingSell(false);
        }
    }, [router]);

    useEffect(() => {
        loadSell();
    }, [loadSell]);

    const loadOrders = useCallback(async () => {
        setLoadingOrders(true);
        try {
            const res = await getMyFoodSellOrders();
            setPending(res.pending);
            setRecentSettled(res.recentSettled);
        } catch {
            setPending([]);
            setRecentSettled([]);
        } finally {
            setLoadingOrders(false);
        }
    }, []);

    useEffect(() => {
        if (tab === "orders") loadOrders();
    }, [tab, loadOrders]);

    const handleSold = () => {
        // Refresh sell-side inventory (quantity just dropped) and, if
        // already looking at Orders, that list too — same "refresh both
        // feeds for real" approach marketplace_page.tsx's handleListed
        // uses.
        loadSell();
        if (tab === "orders") loadOrders();
    };

    return (
        <>
            <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
                <div className="section-header">
                    <span className="section-header-text">Food Market</span>
                </div>

                <hr className="gold-rule" />

                <p className="text-xs text-[rgba(200,168,75,0.5)]">
                    Sell your food and dishes for ryo. Orders settle once a day
                    at that day&apos;s market price — no browsing other
                    players&apos; sales, just a fair price for what you queue.
                </p>

                {/* ── Tabs ── */}
                <div className="flex gap-1.5">
                    {[
                        { id: "sell" as const, label: "Sell" },
                        { id: "orders" as const, label: "My Orders" }
                    ].map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                                tab === t.id
                                    ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b]"
                                    : "border-[rgba(200,168,75,0.15)] text-[rgba(200,168,75,0.5)] hover:border-[rgba(200,168,75,0.35)]"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "sell" && (
                    <>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(200,168,75,0.4)]" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search food…"
                                className="form-input h-10 w-full border pl-9 pr-3 text-sm outline-none"
                            />
                        </div>

                        <SellGrid
                            prices={prices}
                            inventory={inventory}
                            loading={loadingSell}
                            search={search}
                            onPick={(item, price) =>
                                setSellTarget({ item, price })
                            }
                        />
                    </>
                )}

                {tab === "orders" && (
                    <MyOrders
                        pending={pending}
                        recentSettled={recentSettled}
                        loading={loadingOrders}
                    />
                )}
            </section>

            {sellTarget && (
                <SellDrawer
                    item={sellTarget.item}
                    price={sellTarget.price}
                    onClose={() => setSellTarget(null)}
                    onSold={handleSold}
                />
            )}
        </>
    );
}
