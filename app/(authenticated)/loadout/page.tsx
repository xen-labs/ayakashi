"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import {
  getLoadout,
  saveLoadout,
  deleteLoadout,
  ApiResponseError,
} from "../../../lib/api";
import type {
  LoadoutResponse,
  LoadoutKit,
  LoadoutTier,
  LoadoutTool,
} from "../../../lib/api";

// ── Tool toggle button ────────────────────────────────────────────
function ToolToggle({
  tool,
  selected,
  onToggle,
}: {
  tool: LoadoutTool;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2 border px-3 py-2 text-xs transition-all ${
        selected
          ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b]"
          : tool.owned
            ? "border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.60)] hover:border-[rgba(200,168,75,0.50)]"
            : "border-[rgba(200,168,75,0.10)] text-[rgba(200,168,75,0.25)] opacity-50"
      }`}
    >
      <span>{tool.emoji}</span>
      <span className="font-bold">{tool.name}</span>
      {tool.owned && (
        <span className="ml-auto text-[10px] text-[rgba(200,168,75,0.45)]">
          ×{tool.ownedQuantity}
        </span>
      )}
      {selected && (
        <CheckCircle className="ml-auto h-3.5 w-3.5 text-[#c8a84b]" />
      )}
    </button>
  );
}

// ── Kit card ─────────────────────────────────────────────────────
function KitCard({
  kit,
  tier,
  onDelete,
  deleting,
}: {
  kit: LoadoutKit;
  tier: LoadoutTier;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="form-card flex flex-col gap-3 border p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold text-[#f0e6c8]">
          {kit.label}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="text-red-400/50 hover:text-red-400 disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {kit.tools.map((t) => (
          <div
            key={t.itemId}
            className={`flex items-center gap-2 text-xs ${t.owned ? "text-[#f0e6c8]" : "text-[rgba(200,168,75,0.35)]"}`}
          >
            <span>{t.emoji}</span>
            <span>{t.name}</span>
            {!t.owned && (
              <span className="text-red-400 text-[9px] uppercase tracking-widest">
                not owned
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.35)]">
        {tier} kit · slot {kit.slotNumber}
      </p>
    </div>
  );
}

// ── New kit form ──────────────────────────────────────────────────
function NewKitForm({
  tier,
  availableTools,
  maxSlot,
  onSave,
  onCancel,
}: {
  tier: LoadoutTier;
  availableTools: string[];
  maxSlot: number;
  onSave: (
    slotNumber: number,
    toolIds: string[],
    label: string,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [slotNumber, setSlotNumber] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // We need the tool metadata — pass it down from parent
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = async () => {
    if (selected.length === 0) {
      setError("Select at least one tool.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(slotNumber, selected, label.trim() || `Kit ${slotNumber}`);
    } catch (err) {
      setError(
        err instanceof ApiResponseError ? err.error.message : "Failed to save.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-card flex flex-col gap-4 border border-dashed border-[rgba(200,168,75,0.40)] p-5">
      <h3 className="font-display text-xs font-bold uppercase tracking-widest text-[#c8a84b]">
        New {tier} Kit
      </h3>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              placeholder={`Kit ${slotNumber}`}
              className="form-input h-8 border px-2 text-sm outline-none"
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
              onChange={(e) => setSlotNumber(Number(e.target.value))}
              className="form-input h-8 w-16 border px-2 text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
            Tools
          </p>
          {availableTools.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`flex items-center gap-2 border px-3 py-2 text-xs transition-all ${
                selected.includes(id)
                  ? "border-[#c8a84b] bg-[rgba(200,168,75,0.12)] text-[#c8a84b]"
                  : "border-[rgba(200,168,75,0.20)] text-[rgba(200,168,75,0.60)] hover:border-[rgba(200,168,75,0.40)]"
              }`}
            >
              <span className="font-bold">{id}</span>
              {selected.includes(id) && (
                <CheckCircle className="ml-auto h-3.5 w-3.5" />
              )}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 flex-1 border border-[rgba(200,168,75,0.25)] text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.55)] hover:text-[#c8a84b]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="h-8 flex-1 border border-[#c8a84b] text-xs font-bold uppercase tracking-widest text-[#c8a84b] hover:bg-[#c8a84b] hover:text-black disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save Kit"}
        </button>
      </div>
    </div>
  );
}

// ── Tier panel ────────────────────────────────────────────────────
function TierPanel({
  tier,
  kits,
  toolIds,
  maxKitsPerTier,
  onRefresh,
}: {
  tier: LoadoutTier;
  kits: LoadoutKit[];
  toolIds: string[];
  maxKitsPerTier: number;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDelete = async (slotNumber: number) => {
    setDeleting(slotNumber);
    try {
      await deleteLoadout(tier, slotNumber);
      onRefresh();
    } catch {
      /* noop */
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async (
    slotNumber: number,
    toolIds: string[],
    label: string,
  ) => {
    await saveLoadout({ tier, slotNumber, toolIds, label });
    setAdding(false);
    onRefresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[#c8a84b]">
          {tier === "pocket" ? "🎒 Pocket Rob" : "🏠 Vault Breach"} Kits
        </h2>
        {kits.length < maxKitsPerTier && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 border border-[rgba(200,168,75,0.30)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.60)] hover:border-[#c8a84b] hover:text-[#c8a84b]"
          >
            <Plus className="h-3.5 w-3.5" /> New Kit
          </button>
        )}
      </div>

      {kits.length === 0 && !adding && (
        <p className="text-sm text-[rgba(200,168,75,0.40)]">
          No kits saved yet.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {kits.map((k) => (
          <KitCard
            key={k.slotNumber}
            kit={k}
            tier={tier}
            onDelete={() => handleDelete(k.slotNumber)}
            deleting={deleting === k.slotNumber}
          />
        ))}
      </div>

      {adding && (
        <NewKitForm
          tier={tier}
          availableTools={toolIds}
          maxSlot={maxKitsPerTier}
          onSave={handleSave}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function LoadoutPage() {
  const router = useRouter();
  const [data, setData] = useState<LoadoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getLoadout());
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
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <div className="section-header">
        <span className="section-header-text">Loadout</span>
      </div>

      <hr className="gold-rule" />

      <TierPanel
        tier="pocket"
        kits={data.loadouts.pocket}
        toolIds={data.pocketToolIds}
        maxKitsPerTier={data.maxKitsPerTier}
        onRefresh={load}
      />

      <hr className="gold-rule" />

      <TierPanel
        tier="vault"
        kits={data.loadouts.vault}
        toolIds={data.vaultToolIds}
        maxKitsPerTier={data.maxKitsPerTier}
        onRefresh={load}
      />
    </section>
  );
}
