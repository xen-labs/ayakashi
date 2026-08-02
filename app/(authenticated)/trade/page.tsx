"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowLeftRight, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
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
  ApiResponseError,
} from "../../../lib/api";
import type {
  Trade,
  TradeCurrency,
  TradeOffer,
  CardInstance,
  InventoryItem,
  PlayerSearchResult,
} from "../../../lib/api";
import { CurrencyIcon } from "../../components/CurrencyIcon";

// ── helpers ───────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString("en-US"); }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending",   cls: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
  countered: { label: "Countered", cls: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
  accepted:  { label: "Accepted",  cls: "border-green-500/40 text-green-400 bg-green-500/10" },
  declined:  { label: "Declined",  cls: "border-red-500/40 text-red-400 bg-red-500/10" },
  cancelled: { label: "Cancelled", cls: "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.40)] bg-transparent" },
  expired:   { label: "Expired",   cls: "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.40)] bg-transparent" },
};

// ── Offer summary ─────────────────────────────────────────────────
function OfferSummary({ offer, label }: { offer: TradeOffer; label: string }) {
  const empty =
    offer.cardInstanceIds.length === 0 &&
    offer.materials.length === 0 &&
    !offer.currency;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">{label}</p>
      {empty ? (
        <p className="text-xs text-[rgba(200,168,75,0.30)]">Nothing offered</p>
      ) : (
        <>
          {offer.cardInstanceIds.length > 0 && (
            <p className="text-xs text-[#f0e6c8]">🃏 {offer.cardInstanceIds.length} card{offer.cardInstanceIds.length > 1 ? "s" : ""}</p>
          )}
          {offer.materials.map(m => (
            <p key={m.itemId} className="text-xs text-[#f0e6c8]">{m.quantity}× {m.itemId}</p>
          ))}
          {offer.currency && (
            <p className="flex items-center gap-1 text-xs text-[#f0e6c8]">
              <CurrencyIcon type={offer.currency.type} size={12} />
              {fmt(offer.currency.amount)} {offer.currency.type}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Trade row ─────────────────────────────────────────────────────
function TradeRow({ trade, onSelect }: { trade: Trade; onSelect: () => void }) {
  const badge = STATUS_BADGE[trade.status] ?? STATUS_BADGE.pending;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 border-b border-[rgba(200,168,75,0.08)] px-2 py-3 text-left transition-colors last:border-0 hover:bg-[rgba(200,168,75,0.04)]"
    >
      <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-[rgba(200,168,75,0.40)]" />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <p className="truncate text-sm font-bold text-[#f0e6c8]">
          {trade.initiator.displayName} → {trade.recipient.displayName}
        </p>
        <p className="text-[10px] text-[rgba(200,168,75,0.40)]">
          {new Date(trade.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <span className={`shrink-0 border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${badge.cls}`}>
        {badge.label}
      </span>
    </button>
  );
}

// ── Trade detail modal ────────────────────────────────────────────
function TradeDetailModal({
  tradeId,
  myJid,
  onClose,
  onRefresh,
}: {
  tradeId: string;
  myJid: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();
    getTradeById(tradeId).then(setTrade).catch(() => setError("Couldn't load trade."));
  }, [tradeId]);

  const isInitiator = trade?.initiator.jid === myJid;
  const isRecipient = trade?.recipient.jid === myJid;
  const active = trade?.status === "pending" || trade?.status === "countered";

  const act = async (fn: () => Promise<Trade>) => {
    setBusy(true); setError("");
    try {
      await fn();
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof ApiResponseError ? err.error.message : "Action failed.");
    } finally { setBusy(false); }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={e => { if (e.target === dialogRef.current) onClose(); }}
      className="m-auto w-full max-w-md border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col"
    >
      <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">Trade Detail</h2>
        <button type="button" onClick={onClose} className="text-[rgba(200,168,75,0.5)] hover:text-[#c8a84b]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {!trade ? (
          <div className="flex h-32 items-center justify-center">
            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : (
              <svg className="h-6 w-6 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
          </div>
        ) : (
          <>
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[rgba(200,168,75,0.50)]">Status</span>
              <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${STATUS_BADGE[trade.status]?.cls ?? ""}`}>
                {STATUS_BADGE[trade.status]?.label ?? trade.status}
              </span>
            </div>

            {/* Offers */}
            <div className="grid grid-cols-2 gap-4">
              <OfferSummary offer={trade.initiator.offer} label={`${trade.initiator.displayName} offers`} />
              <OfferSummary offer={trade.recipient.offer} label={`${trade.recipient.displayName} offers`} />
            </div>

            {error && (
              <p className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}

            {/* Actions */}
            {active && (
              <div className="flex flex-col gap-2 border-t border-[rgba(200,168,75,0.12)] pt-4">
                {(isRecipient || isInitiator) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => acceptTrade(trade._id))}
                    className="flex items-center justify-center gap-2 h-9 border border-green-500/50 text-xs font-bold uppercase tracking-widest text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Accept
                  </button>
                )}
                {isRecipient && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => declineTrade(trade._id))}
                    className="flex items-center justify-center gap-2 h-9 border border-red-500/50 text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Decline
                  </button>
                )}
                {isInitiator && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => cancelTrade(trade._id))}
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
  onRefresh,
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
  const [myMaterials, setMyMaterials] = useState<InventoryItem[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<{ itemId: string; quantity: number }[]>([]);
  const [currency, setCurrency] = useState<{ type: TradeCurrency; amount: string } | null>(null);
  const [recipientCurrency, setRecipientCurrency] = useState<{ type: TradeCurrency; amount: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchPlayers(query);
        setResults(res.results);
      } catch { /* noop */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadInventory = async () => {
    try {
      const [cards, inv] = await Promise.all([
        getInventoryCards({ sort: "rarity" }),
        getInventory(),
      ]);
      setMyCards(cards.items);
      setMyMaterials(inv.items.filter(i => i.category === "material" && (i.sellPrice ?? 0) > 0));
    } catch { /* noop */ }
  };

  const goToOffer = () => {
    setStep("offer");
    loadInventory();
  };

  const toggleCard = (id: string) => {
    setSelectedCards(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    if (!recipient) return;
    setSubmitting(true); setError("");
    try {
      const myOffer: Partial<TradeOffer> = {
        cardInstanceIds: selectedCards,
        materials: selectedMaterials,
        currency: currency && Number(currency.amount) > 0
          ? { type: currency.type, amount: Number(currency.amount) }
          : null,
      };
      const theirOffer: Partial<TradeOffer> = {
        cardInstanceIds: [],
        materials: [],
        currency: recipientCurrency && Number(recipientCurrency.amount) > 0
          ? { type: recipientCurrency.type, amount: Number(recipientCurrency.amount) }
          : null,
      };
      await proposeTrade({
        recipientUsername: recipient.username,
        initiatorOffer: myOffer,
        recipientOffer: theirOffer,
      });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof ApiResponseError ? err.error.message : "Failed to propose trade.");
    } finally { setSubmitting(false); }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={e => { if (e.target === dialogRef.current) onClose(); }}
      className="m-auto w-full max-w-lg border border-[rgba(200,168,75,0.35)] bg-[#0d0c00] p-0 text-[#f0e6c8] outline-none backdrop:bg-black/80 backdrop:backdrop-blur-sm open:flex open:flex-col max-h-[90vh]"
    >
      <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.15)] px-5 py-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
          {step === "recipient" ? "Propose Trade — Find Player" : `Trade with ${recipient?.displayName}`}
        </h2>
        <button type="button" onClick={onClose} className="text-[rgba(200,168,75,0.5)] hover:text-[#c8a84b]">
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
            {searching && <p className="text-xs text-[rgba(200,168,75,0.40)]">Searching…</p>}
            <div className="flex flex-col gap-1">
              {results.map(r => (
                <button
                  key={r.username}
                  type="button"
                  onClick={() => { setRecipient(r); setQuery(r.displayName); setResults([]); }}
                  className="flex items-center gap-3 border border-[rgba(200,168,75,0.15)] px-3 py-2 text-left hover:border-[rgba(200,168,75,0.40)]"
                >
                  <div>
                    <p className="text-sm font-bold text-[#f0e6c8]">{r.displayName}</p>
                    <p className="text-xs text-[rgba(200,168,75,0.45)]">@{r.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* My cards */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">My Cards (select to offer)</p>
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                {myCards.map(c => (
                  <button
                    key={c.instanceId}
                    type="button"
                    onClick={() => toggleCard(c.instanceId)}
                    className={`relative overflow-hidden border text-left transition-all ${selectedCards.includes(c.instanceId) ? "border-[#c8a84b] ring-1 ring-[#c8a84b]/40" : "border-[rgba(200,168,75,0.20)]"}`}
                  >
                    <div className="flex h-16 items-center justify-center bg-[rgba(200,168,75,0.05)] text-xl">
                      {c.card?.mediaUrl ? (
                        <img src={c.card.mediaUrl} alt={c.card.name} className="h-full w-full object-cover" />
                      ) : "🃏"}
                    </div>
                    <p className="truncate px-1 py-0.5 text-[7px] text-[rgba(200,168,75,0.60)]">{c.card?.name}</p>
                    {selectedCards.includes(c.instanceId) && (
                      <div className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-[#c8a84b] text-[7px] font-bold text-black flex items-center justify-center">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency I offer */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">I Offer Currency (optional)</p>
              <div className="flex items-center gap-2">
                <select
                  value={currency?.type ?? "ryo"}
                  onChange={e => setCurrency(prev => ({ type: e.target.value as TradeCurrency, amount: prev?.amount ?? "" }))}
                  className="form-input h-9 border px-2 text-xs outline-none"
                >
                  <option value="ryo">Ryo</option>
                  <option value="kitsu">Kitsu</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={currency?.amount ?? ""}
                  onChange={e => setCurrency({ type: currency?.type ?? "ryo", amount: e.target.value })}
                  placeholder="Amount"
                  className="form-input h-9 flex-1 border px-3 text-sm outline-none"
                />
                {currency && (
                  <button type="button" onClick={() => setCurrency(null)} className="text-[rgba(200,168,75,0.45)] hover:text-[#c8a84b]">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Currency I want */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.50)]">I Want Currency (optional)</p>
              <div className="flex items-center gap-2">
                <select
                  value={recipientCurrency?.type ?? "ryo"}
                  onChange={e => setRecipientCurrency(prev => ({ type: e.target.value as TradeCurrency, amount: prev?.amount ?? "" }))}
                  className="form-input h-9 border px-2 text-xs outline-none"
                >
                  <option value="ryo">Ryo</option>
                  <option value="kitsu">Kitsu</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={recipientCurrency?.amount ?? ""}
                  onChange={e => setRecipientCurrency({ type: recipientCurrency?.type ?? "ryo", amount: e.target.value })}
                  placeholder="Amount"
                  className="form-input h-9 flex-1 border px-3 text-sm outline-none"
                />
                {recipientCurrency && (
                  <button type="button" onClick={() => setRecipientCurrency(null)} className="text-[rgba(200,168,75,0.45)] hover:text-[#c8a84b]">
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
            <button type="button" onClick={() => setStep("recipient")}
              className="h-10 border border-[rgba(200,168,75,0.30)] px-4 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] hover:text-[#c8a84b]">
              ← Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="flex-1 h-10 border border-[#c8a84b] bg-[#c8a84b] text-xs font-bold uppercase tracking-widest text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send Proposal"}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function TradePage() {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  // We need the current user's jid for action gating — use dashboard or
  // derive from the trade list (any trade where initiator/recipient matches us)
  const [myJid, setMyJid] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getTrades();
      setTrades(res.trades);
      // Derive our jid from the first trade we appear in
      if (res.trades.length > 0) {
        const t = res.trades[0];
        // We'll set it lazily when the detail modal opens — for now leave empty
        void t;
      }
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setError("Couldn't load trades.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const active = trades.filter(t => t.status === "pending" || t.status === "countered");
  const history = trades.filter(t => !["pending", "countered"].includes(t.status));

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <svg className="h-8 w-8 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );

  return (
    <>
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

        <div className="flex items-center justify-between">
          <div className="section-header">
            <span className="section-header-text">Trade</span>
          </div>
          <button
            type="button"
            onClick={() => setProposing(true)}
            className="flex items-center gap-1.5 border border-[#c8a84b] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black"
          >
            <Plus className="h-3.5 w-3.5" /> New Trade
          </button>
        </div>

        <hr className="gold-rule" />

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Active */}
        <div>
          <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
            Active ({active.length})
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-[rgba(200,168,75,0.40)]">No active trades.</p>
          ) : (
            <div className="form-card border">
              {active.map(t => (
                <TradeRow key={t._id} trade={t} onSelect={() => setSelectedId(t._id)} />
              ))}
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <>
            <hr className="gold-rule" />
            <div>
              <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
                History
              </h2>
              <div className="form-card border">
                {history.map(t => (
                  <TradeRow key={t._id} trade={t} onSelect={() => setSelectedId(t._id)} />
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {selectedId && (
        <TradeDetailModal
          tradeId={selectedId}
          myJid={myJid}
          onClose={() => setSelectedId(null)}
          onRefresh={load}
        />
      )}

      {proposing && (
        <ProposeModal onClose={() => setProposing(false)} onRefresh={load} />
      )}
    </>
  );
}
