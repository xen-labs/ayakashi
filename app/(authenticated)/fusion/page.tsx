"use client";

// app/fusion/page.tsx
//
// Fusion: pick N owned cards at one pip-tier, burn them, mint one
// random card at the next tier up. Backend is fully synchronous (see
// core/cardFusion.ts) — the result is known the instant POST /fusion
// resolves, so the "tap to reveal" suspense below is a pure
// PRESENTATION layer over an already-known outcome, not something
// waiting on the server. This matters for how the reveal is built: we
// fetch/mint FIRST (immediately on confirm), hold the result in state,
// and only start the reveal animation once the player taps — the
// animation never blocks on a network call.
//
// Card-back art: three pre-rendered webp images, chosen by the
// FUSION RESULT's rarity (known before the reveal even starts, since
// fusion already happened by then) — SR output shows the blue card
// back, SSR shows the red one, everything else (C/R output — this
// covers pip1->pip2->pip3->R, since only the R->SR and SR->SSR steps
// can ever produce those two specific rarities) uses the neutral one.
// This is a deliberate foreshadowing device: an attentive player can
// tell "I got something good" from the card-back COLOR alone, before
// the reveal even plays — same principle as a gacha game's rarity-
// tinted pull effects.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Sparkles, X, ArrowRight, Check } from "lucide-react";
import {
    getFusionSteps,
    getFusionEligible,
    performFusion,
    ApiResponseError,
    type FusionPipTier,
    type FusionEligibleCard,
    type FusionResult
} from "../../../lib/api";

const TIER_LABELS: Record<FusionPipTier, string> = {
    pip1: "Common I",
    pip2: "Common II",
    pip3: "Common III",
    R: "Rare",
    SR: "Super Rare",
    SSR: "Super Super Rare"
};

const TIER_COLORS: Record<FusionPipTier, string> = {
    pip1: "border-[rgba(200,168,75,0.2)] text-[rgba(200,168,75,0.5)]",
    pip2: "border-[rgba(200,168,75,0.3)] text-[rgba(200,168,75,0.65)]",
    pip3: "border-[rgba(200,168,75,0.4)] text-[#c8a84b]",
    R: "border-[rgba(120,200,150,0.4)] text-[#7fd39c]",
    SR: "border-[rgba(90,160,230,0.45)] text-[#6fb2f0]",
    SSR: "border-[rgba(230,60,60,0.5)] text-[#e85a5a]"
};

const CARD_BACK = {
    blue: "/fusion/cardback-blue.webp",
    red: "/fusion/cardback-red.webp",
    neutral: "/fusion/cardback-neutral.webp"
};

function cardBackFor(rarity: string): string {
    if (rarity === "SR") return CARD_BACK.blue;
    if (rarity === "SSR") return CARD_BACK.red;
    return CARD_BACK.neutral;
}

type RevealStage = "idle" | "charging" | "flash" | "revealed";

export default function FusionPage() {
    const router = useRouter();

    const [steps, setSteps] = useState<
        Partial<
            Record<
                FusionPipTier,
                { from: FusionPipTier; to: FusionPipTier; count: number }
            >
        >
    >({});
    const [order, setOrder] = useState<FusionPipTier[]>([]);
    const [eligible, setEligible] = useState<
        Partial<Record<FusionPipTier, FusionEligibleCard[]>>
    >({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [activeTier, setActiveTier] = useState<FusionPipTier | null>(null);
    const [selected, setSelected] = useState<string[]>([]);

    const [fusing, setFusing] = useState(false);
    const [fuseError, setFuseError] = useState("");
    const [result, setResult] = useState<FusionResult | null>(null);
    const [revealStage, setRevealStage] = useState<RevealStage>("idle");

    useEffect(() => {
        let cancelled = false;
        Promise.all([getFusionSteps(), getFusionEligible()])
            .then(([stepsRes, eligibleRes]) => {
                if (cancelled) return;
                setSteps(stepsRes.steps);
                setOrder(stepsRes.order);
                setEligible(eligibleRes.eligible);
            })
            .catch(() => {
                if (!cancelled)
                    setLoadError("Couldn't load fusion data. Try refreshing.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const refetchEligible = async () => {
        try {
            const res = await getFusionEligible();
            setEligible(res.eligible);
        } catch {
            /* noop */
        }
    };

    const openTier = (tier: FusionPipTier) => {
        setActiveTier(tier);
        setSelected([]);
        setFuseError("");
    };

    const toggleCard = (instanceId: string, cap: number) => {
        setSelected(prev => {
            if (prev.includes(instanceId))
                return prev.filter(id => id !== instanceId);
            if (prev.length >= cap) return prev;
            return [...prev, instanceId];
        });
    };

    const handleFuse = async () => {
        if (!activeTier) return;
        const step = steps[activeTier];
        if (!step || selected.length !== step.count) return;

        setFusing(true);
        setFuseError("");
        try {
            const res = await performFusion(activeTier, selected);
            setResult(res);
            setRevealStage("idle");
            refetchEligible();
        } catch (err) {
            setFuseError(
                err instanceof ApiResponseError
                    ? (err.error.message ?? "Fusion failed.")
                    : "Fusion failed. Try again."
            );
        } finally {
            setFusing(false);
        }
    };

    const handleRevealTap = () => {
        if (revealStage !== "idle") return;
        setRevealStage("charging");
        window.setTimeout(() => setRevealStage("flash"), 900);
        window.setTimeout(() => setRevealStage("revealed"), 1250);
    };

    const closeReveal = () => {
        setResult(null);
        setRevealStage("idle");
        setActiveTier(null);
        setSelected([]);
    };

    if (loading) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center">
                <svg
                    className="h-8 w-8 animate-spin text-[#c8a84b]"
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

    if (loadError) {
        return (
            <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-sm text-[rgba(200,168,75,0.5)]">
                    {loadError}
                </p>
                <button
                    type="button"
                    onClick={() => router.refresh()}
                    className="brush-btn w-40"
                >
                    Retry
                </button>
            </div>
        );
    }

    const fusableTiers = order.filter(t => steps[t]);

    return (
        <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pb-24 pt-6">
            <div className="flex flex-col items-center gap-1 text-center">
                <Sparkles className="h-6 w-6 text-[#c8a84b]" />
                <h1 className="font-display text-lg font-bold uppercase tracking-[0.15em] text-[#c8a84b]">
                    Fusion
                </h1>
                <p className="max-w-xs text-xs text-[rgba(200,168,75,0.5)]">
                    Burn cards at one tier to mint one random card at the next.
                </p>
            </div>

            <div className="flex flex-col gap-2">
                {fusableTiers.map(tier => {
                    const step = steps[tier]!;
                    const owned = eligible[tier]?.length ?? 0;
                    const canFuse = owned >= step.count;
                    return (
                        <button
                            key={tier}
                            type="button"
                            onClick={() => openTier(tier)}
                            disabled={!canFuse}
                            className={`flex items-center justify-between border px-4 py-3 text-left transition-colors ${
                                canFuse
                                    ? "border-[rgba(200,168,75,0.25)] hover:border-[#c8a84b]"
                                    : "cursor-not-allowed border-[rgba(200,168,75,0.1)] opacity-50"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Layers
                                    className={`h-4 w-4 ${TIER_COLORS[tier].split(" ")[1]}`}
                                />
                                <div>
                                    <p className="text-sm font-semibold text-[#f0e6c8]">
                                        {TIER_LABELS[step.from]}{" "}
                                        <ArrowRight className="inline h-3 w-3 text-[rgba(200,168,75,0.4)]" />{" "}
                                        {TIER_LABELS[step.to]}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.4)]">
                                        {owned}/{step.count} owned
                                    </p>
                                </div>
                            </div>
                            <span
                                className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${TIER_COLORS[tier]}`}
                            >
                                {step.count}× → 1
                            </span>
                        </button>
                    );
                })}
            </div>

            {activeTier && steps[activeTier] && (
                <div className="flex flex-col gap-3 border-t border-[rgba(200,168,75,0.15)] pt-5">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.6)]">
                            Select {steps[activeTier]!.count} cards
                        </p>
                        <span className="text-xs text-[#c8a84b]">
                            {selected.length}/{steps[activeTier]!.count}
                        </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {(eligible[activeTier] ?? []).map(c => {
                            const isSelected = selected.includes(c.instanceId);
                            return (
                                <button
                                    key={c.instanceId}
                                    type="button"
                                    onClick={() =>
                                        toggleCard(
                                            c.instanceId,
                                            steps[activeTier]!.count
                                        )
                                    }
                                    className={`relative aspect-[3/4] transition-transform ${
                                        isSelected
                                            ? "scale-[1.03] ring-1 ring-[#c8a84b]/60"
                                            : "hover:scale-[1.02]"
                                    }`}
                                >
                                    {c.mediaType === "video" ? (
                                        <video
                                            src={c.mediaUrl}
                                            className="h-full w-full object-contain"
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                        />
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={c.mediaUrl}
                                            alt={c.cardName}
                                            className="h-full w-full object-contain"
                                        />
                                    )}
                                    {isSelected && (
                                        <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#c8a84b]">
                                            <Check className="h-2.5 w-2.5 text-black" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {fuseError && (
                        <p className="text-xs text-red-400">{fuseError}</p>
                    )}

                    <button
                        type="button"
                        disabled={
                            fusing ||
                            selected.length !== steps[activeTier]!.count
                        }
                        onClick={handleFuse}
                        className="h-11 w-full border border-[#c8a84b] bg-[#c8a84b] text-sm font-bold uppercase tracking-widest text-black transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {fusing ? "Fusing…" : "Fuse"}
                    </button>
                </div>
            )}

            {result && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md">
                    <FusionReveal
                        result={result}
                        stage={revealStage}
                        onTap={handleRevealTap}
                        onClose={closeReveal}
                    />
                </div>
            )}
        </div>
    );
}

function FusionReveal({
    result,
    stage,
    onTap,
    onClose
}: {
    result: FusionResult;
    stage: RevealStage;
    onTap: () => void;
    onClose: () => void;
}) {
    const card = result.outputCard;
    const cardBackSrc = cardBackFor(card.rarity);
    const isRevealed = stage === "revealed";

    return (
        <div className="flex flex-col items-center gap-6 px-6">
            {!isRevealed ? (
                <button
                    type="button"
                    onClick={onTap}
                    disabled={stage !== "idle"}
                    className="relative flex flex-col items-center gap-4"
                >
                    <div
                        className={`pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-all duration-700 ${
                            card.rarity === "SSR"
                                ? "bg-red-500/20"
                                : card.rarity === "SR"
                                  ? "bg-blue-500/20"
                                  : "bg-[#c8a84b]/15"
                        } ${stage === "charging" ? "scale-150 opacity-100" : "scale-100 opacity-60"}`}
                    />

                    <div
                        className={`fusion-cardback relative h-80 w-56 shadow-2xl transition-transform duration-300 ${
                            stage === "idle" ? "fusion-idle-float" : ""
                        } ${stage === "charging" ? "fusion-charging-shake" : ""} ${stage === "flash" ? "fusion-flash-out" : ""}`}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={cardBackSrc}
                            alt=""
                            className="h-full w-full object-contain"
                        />
                        {stage === "charging" && (
                            <div className="fusion-charge-pulse absolute inset-0 bg-white/20" />
                        )}
                    </div>

                    {stage === "flash" && (
                        <div className="fusion-flash-burst pointer-events-none fixed inset-0 z-10 bg-white" />
                    )}

                    {stage === "idle" && (
                        <p className="animate-pulse text-xs uppercase tracking-[0.2em] text-[rgba(200,168,75,0.6)]">
                            Tap to reveal
                        </p>
                    )}
                </button>
            ) : (
                <div className="fusion-reveal-in flex flex-col items-center gap-4">
                    <div className="relative flex flex-col items-center">
                        <div
                            className={`pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${
                                card.rarity === "SSR"
                                    ? "bg-red-500/25"
                                    : card.rarity === "SR"
                                      ? "bg-blue-500/25"
                                      : "bg-[#c8a84b]/15"
                            } fusion-afterglow-pulse`}
                        />
                        <div className="relative h-80 w-56 shadow-[0_0_40px_rgba(200,168,75,0.3)]">
                            {card.mediaType === "video" ? (
                                <video
                                    src={card.mediaUrl}
                                    className="h-full w-full object-contain"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={card.mediaUrl}
                                    alt={card.name}
                                    className="h-full w-full object-contain"
                                />
                            )}
                        </div>
                        <span
                            className="ember-particle absolute -bottom-2 left-6 h-1.5 w-1.5 rounded-full bg-[#e6c96a]"
                            style={{ animationDelay: "0s" }}
                        />
                        <span
                            className="ember-particle absolute -bottom-2 right-6 h-1.5 w-1.5 rounded-full bg-[#e6c96a]"
                            style={{ animationDelay: "0.3s" }}
                        />
                        <span
                            className="ember-particle absolute -bottom-2 left-1/2 h-1.5 w-1.5 rounded-full bg-[#e6c96a]"
                            style={{ animationDelay: "0.6s" }}
                        />
                    </div>

                    <div className="text-center">
                        <span
                            className={`inline-block rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                                card.rarity === "SSR"
                                    ? "border-red-500/50 text-red-400"
                                    : card.rarity === "SR"
                                      ? "border-blue-500/50 text-blue-400"
                                      : "border-[#c8a84b]/50 text-[#c8a84b]"
                            }`}
                        >
                            {card.rarity}
                        </span>
                        <p className="mt-1 text-lg font-semibold text-[#f0e6c8]">
                            {card.name}
                        </p>
                        {card.seriesName && (
                            <p className="text-sm text-[rgba(200,168,75,0.5)]">
                                {card.seriesName}
                            </p>
                        )}
                        <p className="text-[11px] text-[rgba(200,168,75,0.35)]">
                            Copy #{result.issueNumber}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="brush-btn w-44"
                    >
                        Nice
                    </button>
                </div>
            )}

            {stage !== "revealed" && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-4 top-4 text-[rgba(200,168,75,0.4)] hover:text-[#c8a84b]"
                >
                    <X className="h-5 w-5" />
                </button>
            )}
        </div>
    );
}
