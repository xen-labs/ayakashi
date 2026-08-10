"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import {
  getSettingsProfile,
  patchSettingsProfile,
  ApiResponseError,
} from "../../../lib/api";
import type { SettingsProfileResponse } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[rgba(200,168,75,0.08)] py-2.5 last:border-0">
      <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.50)]">
        {label}
      </span>
      <span className="text-sm text-[#f0e6c8]">{value}</span>
    </div>
  );
}

export default function Settings() {
  const router = useRouter();
  const { user } = useAuth(false);

  const [settings, setSettings] = useState<SettingsProfileResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // display name
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState(false);

  // bio
  const [bioInput, setBioInput] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState("");
  const [bioSuccess, setBioSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getSettingsProfile();
      setSettings(res);
      setNameInput(res.displayName ?? "");
      setBioInput(res.bio ?? "");
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError("Couldn't load settings. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const saveDisplayName = async () => {
    if (!settings) return;
    const trimmed = nameInput.trim();
    const { min, max } = settings.limits.displayName;
    if (trimmed.length < min || trimmed.length > max) {
      setNameError(`Display name must be ${min}–${max} characters.`);
      return;
    }
    setNameSaving(true);
    setNameError("");
    setNameSuccess(false);
    try {
      const res = await patchSettingsProfile({ displayName: trimmed });
      if (res.displayName) {
        setNameInput(res.displayName);
        setNameSuccess(true);
        setTimeout(() => setNameSuccess(false), 3000);
        await load();
      }
    } catch (err) {
      if (err instanceof ApiResponseError) {
        if (err.error.code === "display_name_cooldown") {
          setNameError(err.error.message);
        } else {
          setNameError(err.error.message ?? "Failed to save.");
        }
      } else {
        setNameError("Failed to save.");
      }
    } finally {
      setNameSaving(false);
    }
  };

  const saveBio = async () => {
    if (!settings) return;
    const trimmed = bioInput.trim();
    if (trimmed.length > settings.limits.bio.max) {
      setBioError(`Bio must be at most ${settings.limits.bio.max} characters.`);
      return;
    }
    setBioSaving(true);
    setBioError("");
    setBioSuccess(false);
    try {
      await patchSettingsProfile({ bio: trimmed });
      setBioSuccess(true);
      setTimeout(() => setBioSuccess(false), 3000);
      await load();
    } catch (err) {
      setBioError(
        err instanceof ApiResponseError ? err.error.message : "Failed to save.",
      );
    } finally {
      setBioSaving(false);
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

  if (error)
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="text-sm text-[rgba(200,168,75,0.60)]">{error}</p>
        <button type="button" onClick={load} className="brush-btn w-40">
          Retry
        </button>
      </div>
    );

  const cooldown = settings?.displayNameCooldown;
  const canChangeName = cooldown?.canChangeNow ?? false;
  const nameDirty = nameInput.trim() !== (settings?.displayName ?? "");
  const bioDirty = bioInput.trim() !== (settings?.bio ?? "");
  const bioLen = bioInput.length;
  const bioMax = settings?.limits.bio.max ?? 120;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="section-header">
        <span className="section-header-text">Settings</span>
      </div>

      <hr className="gold-rule" />

      {/* ── Account info card ── */}
      <div className="form-card flex flex-col gap-1 border p-5">
        <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
          Account
        </h2>
        <InfoRow
          label="Username"
          value={`@${user?.username ?? settings?.displayName ?? "—"}`}
        />
        <InfoRow
          label="Age"
          value={user?.age != null ? String(user.age) : "—"}
        />
      </div>

      {/* ── Display Name card ── */}
      <div className="form-card flex flex-col gap-4 border p-5">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
          Display Name
        </h2>

        {/* Cooldown status */}
        {cooldown && (
          <div
            className={`flex items-center gap-2 border px-3 py-2 text-xs ${
              canChangeName
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-[rgba(200,168,75,0.25)] bg-[rgba(200,168,75,0.05)] text-[rgba(200,168,75,0.60)]"
            }`}
          >
            {canChangeName ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 shrink-0" /> You can change
                your display name now.
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5 shrink-0" />{" "}
                {cooldown.daysRemaining === 1
                  ? "1 day"
                  : `${cooldown.daysRemaining} days`}{" "}
                until you can change your display name again.
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
            New Display Name
          </label>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-[rgba(200,168,75,0.40)]" />
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={!canChangeName || nameSaving}
              maxLength={settings?.limits.displayName.max ?? 32}
              placeholder="Your display name"
              className="form-input h-10 flex-1 border px-3 text-sm outline-none disabled:opacity-50"
            />
          </div>
          {nameError && (
            <p className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" /> {nameError}
            </p>
          )}
          {nameSuccess && (
            <p className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="h-3 w-3" /> Display name updated!
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!canChangeName || !nameDirty || nameSaving}
          onClick={saveDisplayName}
          className="h-9 self-end border border-[#c8a84b] px-6 text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
        >
          {nameSaving ? "Saving…" : "Save Name"}
        </button>
      </div>

      {/* ── Bio card ── */}
      <div className="form-card flex flex-col gap-4 border p-5">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
          Bio
        </h2>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
              About You
            </label>
            <span
              className={`text-[10px] tabular-nums ${bioLen > bioMax ? "text-red-400" : "text-[rgba(200,168,75,0.35)]"}`}
            >
              {bioLen} / {bioMax}
            </span>
          </div>
          <div className="flex gap-2">
            <FileText className="mt-1 h-4 w-4 shrink-0 text-[rgba(200,168,75,0.40)]" />
            <textarea
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
              disabled={bioSaving}
              rows={3}
              maxLength={bioMax + 10}
              placeholder="Write a short bio for your profile…"
              className="form-input flex-1 resize-none border px-3 py-2 text-sm outline-none disabled:opacity-50"
            />
          </div>
          {bioError && (
            <p className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" /> {bioError}
            </p>
          )}
          {bioSuccess && (
            <p className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="h-3 w-3" /> Bio updated!
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!bioDirty || bioSaving || bioLen > bioMax}
          onClick={saveBio}
          className="h-9 self-end border border-[#c8a84b] px-6 text-xs font-bold uppercase tracking-widest text-[#c8a84b] transition-colors hover:bg-[#c8a84b] hover:text-black disabled:cursor-not-allowed disabled:border-[rgba(200,168,75,0.20)] disabled:text-[rgba(200,168,75,0.25)] disabled:hover:bg-transparent"
        >
          {bioSaving ? "Saving…" : "Save Bio"}
        </button>
      </div>
    </section>
  );
}
