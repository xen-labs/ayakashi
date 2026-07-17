"use client";

import { useState } from "react";
import { Moon, Sun, User } from "lucide-react";
import { useTheme } from "../../components/ThemeProvider";
import { useAuth } from "../../../lib/useAuth";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth(false);
  const [nameInput, setNameInput] = useState(user?.displayName ?? "");

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <h1
        className="theme-heading text-xl font-bold uppercase tracking-widest sm:text-2xl"
        style={{ fontFamily: "serif" }}
      >
        Settings
      </h1>

      {/* Appearance */}
      <div className="form-card flex flex-col gap-4 border p-5 backdrop-blur-md">
        <h2 className="text-xs font-bold uppercase tracking-widest text-astral-gold">
          Appearance
        </h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "dark" ? (
              <Moon className="h-4.5 w-4.5 text-gray-400" />
            ) : (
              <Sun className="h-4.5 w-4.5 text-gray-400" />
            )}
            <div>
              <p className="theme-body text-sm font-semibold">Theme</p>
              <p className="text-xs text-gray-500">
                {theme === "dark" ? "Dark mode" : "Light mode"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            className="h-9 border border-astral-gold px-4 text-xs font-bold uppercase tracking-widest text-astral-gold transition-colors hover:bg-astral-gold hover:text-black"
          >
            Switch to {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      {/* Profile */}
      <div className="form-card flex flex-col gap-4 border p-5 backdrop-blur-md">
        <h2 className="text-xs font-bold uppercase tracking-widest text-astral-gold">
          Profile
        </h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Display Name
          </label>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled
              className="form-input h-10 flex-1 border px-3 text-sm opacity-50 outline-none"
            />
          </div>
          <p className="text-xs text-gray-500">
            Display name editing is coming soon.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Username
          </label>
          <p className="theme-body text-sm">@{user?.username}</p>
        </div>
      </div>
    </section>
  );
}
