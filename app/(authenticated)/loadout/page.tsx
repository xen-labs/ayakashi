"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    Plus,
    Trash2,
    CheckCircle2,
    Backpack,
    ShieldAlert,
    Sword,
    Wind,
    DoorOpen,
    Hammer,
    User,
    X,
    ScrollText,
    Coins,
    Siren,
    ChevronLeft,
    ChevronRight,
    ArrowDownRight,
    ArrowUpRight
} from "lucide-react";
import {
    getLoadout,
    saveLoadout,
    deleteLoadout,
    getInventory,
    getRobLog,
    ApiResponseError
} from "../../../lib/api";
import type {
    LoadoutResponse,
    PocketKit,
    VaultKit,
    LoadoutTool,
    VaultPath,
    RobLogEntry,
    RobLogResponse
} from "../../../lib/api";

// ── Item art — the signature element of this page's redesign. Real
// webp/png artwork in a small beveled frame, replacing the old
// text-inline emoji. Falls back gracefully to the emoji glyph (still
// inside the same frame, so layout never jumps) when an item genuinely
// has no registry art yet — see api.ts's LoadoutTool.webappImage comment.
// Rarity tints the frame's border/glow so a glance at a kit card already
// hints at how serious the gear in it is, without needing to read text.
const RARITY_RING: Record<string, string> = {
    common: "border-[rgba(200,168,75,0.25)]",
    uncommon: "border-emerald-400/40",
    rare: "border-sky-400/40",
    epic: "border-violet-400/50",
    legendary:
        "border-amber-400/60 shadow-[0_0_14px_-2px_rgba(251,191,36,0.35)]"
};

function ItemArt({
    tool,
    size = 40,
    dimmed = false
}: {
    tool: Pick<LoadoutTool, "webappImage" | "emoji" | "rarity" | "name"> | null;
    size?: number;
    dimmed?: boolean;
}) {
    const ring = tool?.rarity
        ? RARITY_RING[tool.rarity]
        : "border-[rgba(200,168,75,0.20)]";
    return (
        <div
            className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-black/60 ${ring} ${dimmed ? "opacity-40 grayscale" : ""}`}
            style={{ width: size, height: size }}
        >
            {tool?.webappImage ? (
                <Image
                    src={tool.webappImage}
                    alt={tool.name ?? "item"}
                    fill
                    sizes={`${size}px`}
                    className="object-contain p-1"
                />
            ) : (
                <span
                    className="leading-none"
                    style={{ fontSize: Math.round(size * 0.5) }}
                >
                    {tool?.emoji ?? "❔"}
                </span>
            )}
        </div>
    );
}

// ── Tool pill — single-select style, shows ownership ─────────────────
function ToolPill({
    itemId,
    tool,
    selected,
    onSelect
}: {
    itemId: string;
    tool: LoadoutTool | undefined;
    selected: boolean;
    onSelect: () => void;
}) {
    const owned = tool?.owned ?? false;
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={!owned}
            className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-xs transition-all disabled:cursor-not-allowed ${
                selected
                    ? "border-ayakashi-gold bg-ayakashi-gold/12 text-ayakashi-gold"
                    : owned
                      ? "border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.65)] hover:border-[rgba(200,168,75,0.50)]"
                      : "border-[rgba(200,168,75,0.10)] text-[rgba(200,168,75,0.25)] opacity-50"
            }`}
        >
            <ItemArt tool={tool ?? null} size={28} dimmed={!owned} />
            <span className="flex-1 truncate font-bold">
                {tool?.name ?? itemId}
            </span>
            {!owned && (
                <span className="shrink-0 text-[9px] uppercase tracking-widest text-red-400/70">
                    not owned
                </span>
            )}
            {selected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
        </button>
    );
}

// ── Optional-slot tool grid (breach/escape/bag) — includes a "none" pill
function OptionalToolGrid({
    icon,
    label,
    ids,
    selected,
    ownedMap,
    onChange
}: {
    icon: React.ReactNode;
    label: string;
    ids: string[];
    selected: string | null;
    ownedMap: Map<string, LoadoutTool>;
    onChange: (id: string | null) => void;
}) {
    if (ids.length === 0) return null;
    return (
        <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                {icon} {label}{" "}
                <span className="text-[rgba(200,168,75,0.30)]">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className={`rounded-md border px-3 py-2 text-xs font-bold transition-all ${
                        selected === null
                            ? "border-ayakashi-gold bg-ayakashi-gold/12 text-ayakashi-gold"
                            : "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.45)] hover:border-[rgba(200,168,75,0.40)]"
                    }`}
                >
                    None
                </button>
                {ids.map(id => {
                    const tool = ownedMap.get(id);
                    return (
                        <ToolPill
                            key={id}
                            itemId={id}
                            tool={tool}
                            selected={selected === id}
                            onSelect={() => onChange(id)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// ── Pocket kit card ───────────────────────────────────────────────
function PocketKitCard({
    kit,
    onDelete,
    deleting
}: {
    kit: PocketKit;
    onDelete: () => void;
    deleting: boolean;
}) {
    return (
        <div className="craft-card flex flex-col gap-3 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-[#f0e6c8]">
                    {kit.label}
                </span>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleting}
                    className="text-red-400/50 transition-colors hover:text-red-400 disabled:opacity-30"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
            {kit.weapon ? (
                <div className="flex items-center gap-3">
                    <ItemArt
                        tool={kit.weapon}
                        size={40}
                        dimmed={!kit.weapon.owned}
                    />
                    <div className="min-w-0 flex-1">
                        <p
                            className={`truncate text-sm font-bold ${kit.weapon.owned ? "text-[#f0e6c8]" : "text-[rgba(200,168,75,0.35)]"}`}
                        >
                            {kit.weapon.name}
                        </p>
                        {!kit.weapon.owned && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">
                                not owned
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-[rgba(200,168,75,0.35)]">
                    No weapon set.
                </p>
            )}
            <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
                Slot {kit.slotNumber}
            </p>
        </div>
    );
}

// ── Vault kit card ────────────────────────────────────────────────
function VaultKitCard({
    kit,
    onDelete,
    deleting
}: {
    kit: VaultKit;
    onDelete: () => void;
    deleting: boolean;
}) {
    const rows: { icon: React.ReactNode; tool: LoadoutTool | null }[] = [
        { icon: <DoorOpen className="h-3 w-3" />, tool: kit.entryTool },
        { icon: <Hammer className="h-3 w-3" />, tool: kit.breachTool },
        { icon: <Wind className="h-3 w-3" />, tool: kit.escapeTool },
        { icon: <Backpack className="h-3 w-3" />, tool: kit.bag }
    ];

    return (
        <div className="craft-card flex flex-col gap-3 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-[#f0e6c8]">
                    {kit.label}
                </span>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleting}
                    className="text-red-400/50 transition-colors hover:text-red-400 disabled:opacity-30"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>

            <span
                className={`w-fit rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                    kit.path === "stealth"
                        ? "border-blue-500/30 text-blue-400"
                        : "border-red-500/30 text-red-400"
                }`}
            >
                {kit.path}
            </span>

            <div className="flex flex-col gap-2">
                {rows.map(({ icon, tool }, i) =>
                    tool ? (
                        <div key={i} className="flex items-center gap-2.5">
                            <ItemArt
                                tool={tool}
                                size={30}
                                dimmed={!tool.owned}
                            />
                            <span className="shrink-0 text-[rgba(200,168,75,0.45)]">
                                {icon}
                            </span>
                            <span
                                className={`min-w-0 flex-1 truncate text-xs ${tool.owned ? "text-[#f0e6c8]" : "text-[rgba(200,168,75,0.35)]"}`}
                            >
                                {tool.name}
                            </span>
                            {!tool.owned && (
                                <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-red-400">
                                    not owned
                                </span>
                            )}
                        </div>
                    ) : null
                )}
            </div>

            <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
                Slot {kit.slotNumber}
            </p>
        </div>
    );
}

// ── New Pocket kit form ───────────────────────────────────────────
function NewPocketForm({
    weaponIds,
    toolsById,
    maxSlot,
    usedSlots,
    onSave,
    onCancel
}: {
    weaponIds: string[];
    toolsById: Map<string, LoadoutTool>;
    maxSlot: number;
    usedSlots: number[];
    onSave: (
        slotNumber: number,
        weaponId: string,
        label: string
    ) => Promise<void>;
    onCancel: () => void;
}) {
    const nextSlot =
        Array.from({ length: maxSlot }, (_, i) => i + 1).find(
            s => !usedSlots.includes(s)
        ) ?? 1;
    const [weaponId, setWeaponId] = useState<string | null>(null);
    const [label, setLabel] = useState("");
    const [slotNumber, setSlotNumber] = useState(nextSlot);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const submit = async () => {
        if (!weaponId) {
            setError("Pick a weapon.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            await onSave(slotNumber, weaponId, label.trim());
        } catch (err) {
            setError(
                err instanceof ApiResponseError
                    ? err.error.message
                    : "Failed to save."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="form-card flex flex-col gap-4 rounded-xl border border-dashed border-[rgba(200,168,75,0.40)] p-5">
            <div className="flex items-center justify-between">
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
                    New Pocket Kit
                </h3>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-[rgba(200,168,75,0.45)] hover:text-ayakashi-gold"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex flex-1 flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                        Label
                    </label>
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        maxLength={40}
                        placeholder={`Kit ${slotNumber}`}
                        className="form-input h-9 border px-2 text-sm outline-none"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                        Slot
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={maxSlot}
                        value={slotNumber}
                        onChange={e =>
                            setSlotNumber(
                                Math.min(
                                    maxSlot,
                                    Math.max(1, Number(e.target.value))
                                )
                            )
                        }
                        className="form-input h-9 w-16 border px-2 text-sm outline-none"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                    <Sword className="h-3.5 w-3.5" /> Weapon
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {weaponIds.map(id => {
                        const tool = toolsById.get(id);
                        return (
                            <ToolPill
                                key={id}
                                itemId={id}
                                tool={tool}
                                selected={weaponId === id}
                                onSelect={() => setWeaponId(id)}
                            />
                        );
                    })}
                </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="h-9 flex-1 rounded-md border border-[rgba(200,168,75,0.25)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)] transition-colors hover:text-ayakashi-gold"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="h-9 flex-1 rounded-md border border-ayakashi-gold text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:opacity-40"
                >
                    {saving ? "Saving…" : "Save Kit"}
                </button>
            </div>
        </div>
    );
}

// ── New Vault kit form ────────────────────────────────────────────
function NewVaultForm({
    entryStealthIds,
    entryAggressiveIds,
    breachIds,
    escapeIds,
    bagIds,
    toolsById,
    maxSlot,
    usedSlots,
    onSave,
    onCancel
}: {
    entryStealthIds: string[];
    entryAggressiveIds: string[];
    breachIds: string[];
    escapeIds: string[];
    bagIds: string[];
    toolsById: Map<string, LoadoutTool>;
    maxSlot: number;
    usedSlots: number[];
    onSave: (
        slotNumber: number,
        path: VaultPath,
        entryToolId: string,
        breachToolId: string | null,
        escapeToolId: string | null,
        bagId: string | null,
        label: string
    ) => Promise<void>;
    onCancel: () => void;
}) {
    const nextSlot =
        Array.from({ length: maxSlot }, (_, i) => i + 1).find(
            s => !usedSlots.includes(s)
        ) ?? 1;
    const [path, setPath] = useState<VaultPath>("stealth");
    const [entryToolId, setEntryToolId] = useState<string | null>(null);
    const [breachToolId, setBreachToolId] = useState<string | null>(null);
    const [escapeToolId, setEscapeToolId] = useState<string | null>(null);
    const [bagId, setBagId] = useState<string | null>(null);
    const [label, setLabel] = useState("");
    const [slotNumber, setSlotNumber] = useState(nextSlot);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const entryPool = path === "stealth" ? entryStealthIds : entryAggressiveIds;

    const handlePathChange = (p: VaultPath) => {
        setPath(p);
        setEntryToolId(null); // entry pool changes with path — clear invalid selection
    };

    const submit = async () => {
        if (!entryToolId) {
            setError("Pick an entry tool.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            await onSave(
                slotNumber,
                path,
                entryToolId,
                breachToolId,
                escapeToolId,
                bagId,
                label.trim()
            );
        } catch (err) {
            setError(
                err instanceof ApiResponseError
                    ? err.error.message
                    : "Failed to save."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="form-card flex flex-col gap-4 rounded-xl border border-dashed border-[rgba(200,168,75,0.40)] p-5">
            <div className="flex items-center justify-between">
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
                    New Vault Kit
                </h3>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-[rgba(200,168,75,0.45)] hover:text-ayakashi-gold"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex flex-1 flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                        Label
                    </label>
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        maxLength={40}
                        placeholder={`Kit ${slotNumber}`}
                        className="form-input h-9 border px-2 text-sm outline-none"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                        Slot
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={maxSlot}
                        value={slotNumber}
                        onChange={e =>
                            setSlotNumber(
                                Math.min(
                                    maxSlot,
                                    Math.max(1, Number(e.target.value))
                                )
                            )
                        }
                        className="form-input h-9 w-16 border px-2 text-sm outline-none"
                    />
                </div>
            </div>

            {/* Path — pivot field, drives entry pool */}
            <div className="flex flex-col gap-1.5">
                <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                    Path
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => handlePathChange("stealth")}
                        className={`flex items-center justify-center gap-2 rounded-md border py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                            path === "stealth"
                                ? "border-blue-400 bg-blue-500/12 text-blue-400"
                                : "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.50)] hover:border-blue-400/40"
                        }`}
                    >
                        <User className="h-3.5 w-3.5" /> Stealth
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePathChange("aggressive")}
                        className={`flex items-center justify-center gap-2 rounded-md border py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                            path === "aggressive"
                                ? "border-red-400 bg-red-500/12 text-red-400"
                                : "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.50)] hover:border-red-400/40"
                        }`}
                    >
                        <ShieldAlert className="h-3.5 w-3.5" /> Aggressive
                    </button>
                </div>
            </div>

            {/* Entry tool — required, pool depends on path */}
            <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
                    <DoorOpen className="h-3.5 w-3.5" /> Entry Tool
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {entryPool.map(id => {
                        const tool = toolsById.get(id);
                        return (
                            <ToolPill
                                key={id}
                                itemId={id}
                                tool={tool}
                                selected={entryToolId === id}
                                onSelect={() => setEntryToolId(id)}
                            />
                        );
                    })}
                </div>
            </div>

            <OptionalToolGrid
                icon={<Hammer className="h-3.5 w-3.5" />}
                label="Breach Tool"
                ids={breachIds}
                selected={breachToolId}
                ownedMap={toolsById}
                onChange={setBreachToolId}
            />
            <OptionalToolGrid
                icon={<Wind className="h-3.5 w-3.5" />}
                label="Escape Tool"
                ids={escapeIds}
                selected={escapeToolId}
                ownedMap={toolsById}
                onChange={setEscapeToolId}
            />
            <OptionalToolGrid
                icon={<Backpack className="h-3.5 w-3.5" />}
                label="Bag"
                ids={bagIds}
                selected={bagId}
                ownedMap={toolsById}
                onChange={setBagId}
            />

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="h-9 flex-1 rounded-md border border-[rgba(200,168,75,0.25)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)] transition-colors hover:text-ayakashi-gold"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="h-9 flex-1 rounded-md border border-ayakashi-gold text-xs font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:bg-ayakashi-gold hover:text-black disabled:opacity-40"
                >
                    {saving ? "Saving…" : "Save Kit"}
                </button>
            </div>
        </div>
    );
}

// ── Rob log entry row ────────────────────────────────────────────
// One row per attempt. Deliberately shows NAMES only (robberName/
// targetName, pre-resolved server-side) — never robberId/targetId, never
// an @mention. This is a read-only history view.
const OUTCOME_STYLE: Record<
    string,
    { label: string; icon: React.ReactNode; color: string }
> = {
    success: {
        label: "Success",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    },
    failed_roll: {
        label: "Failed",
        icon: <X className="h-3.5 w-3.5" />,
        color: "text-[rgba(200,168,75,0.55)] border-[rgba(200,168,75,0.20)] bg-white/[0.02]"
    },
    caught: {
        label: "Caught",
        icon: <Siren className="h-3.5 w-3.5" />,
        color: "text-red-400 border-red-500/30 bg-red-500/10"
    },
    police_intercepted: {
        label: "Police Called",
        icon: <Siren className="h-3.5 w-3.5" />,
        color: "text-red-400 border-red-500/30 bg-red-500/10"
    },
    vault_entry_failed: {
        label: "Entry Failed",
        icon: <DoorOpen className="h-3.5 w-3.5" />,
        color: "text-[rgba(200,168,75,0.55)] border-[rgba(200,168,75,0.20)] bg-white/[0.02]"
    },
    vault_no_stash: {
        label: "Nothing To Take",
        icon: <Backpack className="h-3.5 w-3.5" />,
        color: "text-[rgba(200,168,75,0.55)] border-[rgba(200,168,75,0.20)] bg-white/[0.02]"
    }
};

function fmtWhen(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function RobLogRow({
    entry,
    view,
    toolsById
}: {
    entry: RobLogEntry;
    view: "robber" | "victim";
    toolsById: Map<string, LoadoutTool>;
}) {
    const style =
        OUTCOME_STYLE[entry.outcomeReason] ?? OUTCOME_STYLE.failed_roll;
    const weaponTool = entry.weaponId
        ? toolsById.get(entry.weaponId)
        : undefined;
    const counterTool = entry.counterItemId
        ? toolsById.get(entry.counterItemId)
        : undefined;
    const otherPartyName =
        view === "robber" ? entry.targetName : entry.robberName;
    const lootLabel =
        entry.stolenRyo > 0 || entry.stolenKitsu > 0
            ? [
                  entry.stolenRyo > 0
                      ? `${entry.stolenRyo.toLocaleString()} 両`
                      : null,
                  entry.stolenKitsu > 0 ? `${entry.stolenKitsu} kitsu` : null
              ]
                  .filter(Boolean)
                  .join(" + ")
            : null;

    return (
        <div className="craft-card flex items-center gap-3 rounded-lg p-3">
            <ItemArt
                tool={
                    weaponTool ?? {
                        webappImage: "",
                        emoji: entry.targetTier === "vault" ? "🏦" : "👛",
                        name: entry.targetTier,
                        rarity: undefined
                    }
                }
                size={38}
            />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs">
                    {view === "robber" ? (
                        <ArrowUpRight className="h-3 w-3 shrink-0 text-[rgba(200,168,75,0.45)]" />
                    ) : (
                        <ArrowDownRight className="h-3 w-3 shrink-0 text-[rgba(200,168,75,0.45)]" />
                    )}
                    <span className="truncate font-bold text-[#f0e6c8]">
                        {otherPartyName}
                    </span>
                    <span className="shrink-0 text-[rgba(200,168,75,0.35)]">
                        · {entry.targetTier}
                        {entry.path ? `, ${entry.path}` : ""}
                    </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[rgba(200,168,75,0.45)]">
                    <span>{fmtWhen(entry.createdAt)}</span>
                    {entry.successRate !== null && (
                        <span>· rolled {entry.successRate}%</span>
                    )}
                    {view === "victim" && counterTool && (
                        <span>
                            ·{" "}
                            {entry.targetHadCounter
                                ? "counter held"
                                : "counter missing"}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                    className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${style.color}`}
                >
                    {style.icon}
                    {style.label}
                </span>
                {lootLabel && (
                    <span
                        className={`flex items-center gap-1 text-[11px] font-bold ${
                            view === "robber"
                                ? "text-emerald-400"
                                : "text-red-400"
                        }`}
                    >
                        <Coins className="h-3 w-3" />
                        {lootLabel}
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Rob log section ──────────────────────────────────────────────
// [NEW] Paginated activity feed backed by GET /roblog. Two toggleable
// views (own attempts / attempts against you) rather than one merged
// feed, since "who did what to whom" is genuinely two different
// questions a player asks, and merging them would need extra UI per row
// just to disambiguate direction — the toggle does that job once, up
// front, instead.
function RobLogSection({ toolsById }: { toolsById: Map<string, LoadoutTool> }) {
    const [view, setView] = useState<"robber" | "victim">("robber");
    const [page, setPage] = useState(1);
    const [log, setLog] = useState<RobLogResponse | null>(null);
    const [logLoading, setLogLoading] = useState(true);
    const [logError, setLogError] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLogLoading(true);
        setLogError("");
        getRobLog(view, page)
            .then(res => {
                if (!cancelled) setLog(res);
            })
            .catch(() => {
                if (!cancelled) setLogError("Couldn't load rob history.");
            })
            .finally(() => {
                if (!cancelled) setLogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [view, page]);

    const switchView = (next: "robber" | "victim") => {
        if (next === view) return;
        setView(next);
        setPage(1);
    };

    return (
        <section className="flex flex-col gap-4">
            <hr className="gold-rule" />

            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(200,168,75,0.30)] bg-black/50 text-ayakashi-gold">
                    <ScrollText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                    <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                        Rob Log
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                        Recent attempts, both directions
                    </p>
                </div>

                <div className="flex shrink-0 rounded-md border border-[rgba(200,168,75,0.25)] p-0.5">
                    <button
                        type="button"
                        onClick={() => switchView("robber")}
                        className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            view === "robber"
                                ? "bg-ayakashi-gold text-black"
                                : "text-[rgba(200,168,75,0.55)] hover:text-ayakashi-gold"
                        }`}
                    >
                        By You
                    </button>
                    <button
                        type="button"
                        onClick={() => switchView("victim")}
                        className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            view === "victim"
                                ? "bg-ayakashi-gold text-black"
                                : "text-[rgba(200,168,75,0.55)] hover:text-ayakashi-gold"
                        }`}
                    >
                        Against You
                    </button>
                </div>
            </div>

            {log && log.pageSummary.entryCount > 0 && (
                <div className="flex items-center gap-4 text-[11px] text-[rgba(200,168,75,0.55)]">
                    <span>
                        <strong className="text-[#f0e6c8]">
                            {log.pageSummary.successCount}
                        </strong>
                        /{log.pageSummary.entryCount} successful
                    </span>
                    <span>
                        <strong
                            className={
                                view === "robber"
                                    ? "text-emerald-400"
                                    : "text-red-400"
                            }
                        >
                            {log.pageSummary.totalRyo.toLocaleString()} 両
                        </strong>{" "}
                        {view === "robber" ? "earned" : "lost"} this page
                    </span>
                </div>
            )}

            {logLoading && (
                <p className="text-sm text-[rgba(200,168,75,0.40)]">Loading…</p>
            )}
            {logError && <p className="text-sm text-red-400">{logError}</p>}

            {!logLoading && !logError && log && log.entries.length === 0 && (
                <p className="text-sm text-[rgba(200,168,75,0.40)]">
                    {view === "robber"
                        ? "You haven't attempted a rob yet."
                        : "No one's tried to rob you yet."}
                </p>
            )}

            {!logLoading && !logError && log && log.entries.length > 0 && (
                <>
                    <div className="flex flex-col gap-2">
                        {log.entries.map(entry => (
                            <RobLogRow
                                key={entry.id}
                                entry={entry}
                                view={view}
                                toolsById={toolsById}
                            />
                        ))}
                    </div>

                    {log.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:opacity-30"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.45)]">
                                Page {log.page} of {log.totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setPage(p =>
                                        Math.min(log.totalPages, p + 1)
                                    )
                                }
                                disabled={page >= log.totalPages}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold disabled:opacity-30"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

// ── Main page ──────────────────────────────────────────────────────
export default function LoadoutPage() {
    const router = useRouter();
    const [data, setData] = useState<LoadoutResponse | null>(null);
    const [toolsById, setToolsById] = useState<Map<string, LoadoutTool>>(
        new Map()
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [addingPocket, setAddingPocket] = useState(false);
    const [addingVault, setAddingVault] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [loadoutRes, invRes] = await Promise.all([
                getLoadout(),
                getInventory()
            ]);
            setData(loadoutRes);
            // Build the tool lookup from the full inventory catalog, not just
            // whatever's already saved in a kit — this gives every pool id
            // (including never-yet-picked tools) a real name/emoji/owned state.
            const map = new Map<string, LoadoutTool>();
            for (const item of invRes.items) {
                map.set(item.itemId, {
                    itemId: item.itemId,
                    name: item.name,
                    emoji: item.emoji,
                    // [FIXED] Previously dropped here even though InventoryItem
                    // already carries both — this was the actual reason real item
                    // art wouldn't have shown up anywhere on this page even after
                    // the backend started sending it: this map is what every kit
                    // card and ToolPill reads from, not the raw inventory response.
                    webappImage: item.webappImage,
                    rarity: item.rarity,
                    owned: item.quantity > 0,
                    ownedQuantity: item.quantity
                });
            }
            setToolsById(map);
        } catch (err) {
            if (err instanceof ApiResponseError && err.status === 401) {
                router.push("/login");
                return;
            }
            setError("Couldn't load loadouts.");
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        load();
    }, [load]);

    const handleDeletePocket = async (slotNumber: number) => {
        setDeleting(`pocket-${slotNumber}`);
        try {
            await deleteLoadout("pocket", slotNumber);
            await load();
        } catch {
            /* noop */
        } finally {
            setDeleting(null);
        }
    };
    const handleDeleteVault = async (slotNumber: number) => {
        setDeleting(`vault-${slotNumber}`);
        try {
            await deleteLoadout("vault", slotNumber);
            await load();
        } catch {
            /* noop */
        } finally {
            setDeleting(null);
        }
    };

    const handleSavePocket = async (
        slotNumber: number,
        weaponId: string,
        label: string
    ) => {
        await saveLoadout({
            tier: "pocket",
            slotNumber,
            weaponId,
            label: label || undefined
        });
        setAddingPocket(false);
        await load();
    };
    const handleSaveVault = async (
        slotNumber: number,
        path: VaultPath,
        entryToolId: string,
        breachToolId: string | null,
        escapeToolId: string | null,
        bagId: string | null,
        label: string
    ) => {
        await saveLoadout({
            tier: "vault",
            slotNumber,
            path,
            entryToolId,
            breachToolId,
            escapeToolId,
            bagId,
            label: label || undefined
        });
        setAddingVault(false);
        await load();
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

    // Any pool id genuinely absent from inventory (e.g. a tool the player has
    // never picked up at all) still renders — via ToolPill's fallback to raw
    // itemId with owned:false — but that's now the true "never owned" case,
    // not a lookup gap.
    const pocketUsedSlots = data.loadouts.pocket.map(k => k.slotNumber);
    const vaultUsedSlots = data.loadouts.vault.map(k => k.slotNumber);

    return (
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
            <div className="section-header">
                <span className="section-header-text">Loadout</span>
            </div>

            <hr className="gold-rule" />

            {/* ── Pocket ── */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(200,168,75,0.30)] bg-black/50 text-ayakashi-gold">
                        <Backpack className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                            Pocket Rob Kits
                        </h2>
                        <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                            One weapon per kit
                        </p>
                    </div>
                    {data.loadouts.pocket.length < data.maxKitsPerTier &&
                        !addingPocket && (
                            <button
                                type="button"
                                onClick={() => setAddingPocket(true)}
                                className="flex shrink-0 items-center gap-1.5 rounded-md border border-[rgba(200,168,75,0.30)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold"
                            >
                                <Plus className="h-3.5 w-3.5" /> New Kit
                            </button>
                        )}
                </div>

                {data.loadouts.pocket.length === 0 && !addingPocket && (
                    <p className="text-sm text-[rgba(200,168,75,0.40)]">
                        No pocket kits saved yet.
                    </p>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {data.loadouts.pocket.map(kit => (
                        <PocketKitCard
                            key={kit.slotNumber}
                            kit={kit}
                            onDelete={() => handleDeletePocket(kit.slotNumber)}
                            deleting={deleting === `pocket-${kit.slotNumber}`}
                        />
                    ))}
                </div>

                {addingPocket && (
                    <NewPocketForm
                        weaponIds={data.pocketWeaponIds}
                        toolsById={toolsById}
                        maxSlot={data.maxKitsPerTier}
                        usedSlots={pocketUsedSlots}
                        onSave={handleSavePocket}
                        onCancel={() => setAddingPocket(false)}
                    />
                )}
            </div>

            <hr className="gold-rule" />

            {/* ── Vault ── */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(200,168,75,0.30)] bg-black/50 text-ayakashi-gold">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#f0e6c8]">
                            Vault Breach Kits
                        </h2>
                        <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                            Path + entry, breach, escape, bag
                        </p>
                    </div>
                    {data.loadouts.vault.length < data.maxKitsPerTier &&
                        !addingVault && (
                            <button
                                type="button"
                                onClick={() => setAddingVault(true)}
                                className="flex shrink-0 items-center gap-1.5 rounded-md border border-[rgba(200,168,75,0.30)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] transition-colors hover:border-ayakashi-gold hover:text-ayakashi-gold"
                            >
                                <Plus className="h-3.5 w-3.5" /> New Kit
                            </button>
                        )}
                </div>

                {data.loadouts.vault.length === 0 && !addingVault && (
                    <p className="text-sm text-[rgba(200,168,75,0.40)]">
                        No vault kits saved yet.
                    </p>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {data.loadouts.vault.map(kit => (
                        <VaultKitCard
                            key={kit.slotNumber}
                            kit={kit}
                            onDelete={() => handleDeleteVault(kit.slotNumber)}
                            deleting={deleting === `vault-${kit.slotNumber}`}
                        />
                    ))}
                </div>

                {addingVault && (
                    <NewVaultForm
                        entryStealthIds={data.vaultEntryStealthIds}
                        entryAggressiveIds={data.vaultEntryAggressiveIds}
                        breachIds={data.vaultBreachIds}
                        escapeIds={data.vaultEscapeIds}
                        bagIds={data.vaultBagIds}
                        toolsById={toolsById}
                        maxSlot={data.maxKitsPerTier}
                        usedSlots={vaultUsedSlots}
                        onSave={handleSaveVault}
                        onCancel={() => setAddingVault(false)}
                    />
                )}
            </div>

            <RobLogSection toolsById={toolsById} />
        </section>
    );
}
