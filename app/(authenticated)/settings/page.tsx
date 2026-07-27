"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { useAuth } from "../../../lib/useAuth";

export default function Settings() {
  const { user } = useAuth(false);
  const [nameInput, setNameInput] = useState(user?.displayName ?? "");

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

      {/* ── Brush-stroke header ── */}
      <div className="section-header">
        <span className="section-header-text">Settings</span>
      </div>

      <hr className="gold-rule" />

      {/* ── Profile card ── */}
      <div className="form-card flex flex-col gap-5 border p-6">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.1em] text-[#c8a84b]">
          Profile
        </h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
            Display Name
          </label>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-[rgba(200,168,75,0.40)]" />
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled
              className="form-input h-10 flex-1 border px-3 text-sm opacity-50 outline-none"
            />
          </div>
          <p className="text-xs text-[rgba(200,168,75,0.35)]">
            Display name editing is coming soon.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-[rgba(200,168,75,0.55)]">
            Username
          </label>
          <p className="text-sm text-[#a89880]">@{user?.username}</p>
        </div>
      </div>
    </section>
  );
}
