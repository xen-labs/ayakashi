"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, FormEvent } from "react";
import { type Value as PhoneValue } from "react-phone-number-input";
import { PhoneField } from "../components/PhoneField";
import { PasswordField } from "../components/PasswordField";
import { TosModal } from "../components/TosModal";

// ── Form state type ────────────────────────────────────────────────
interface FormData {
  playerName: string;
  email: string;
  whatsapp: PhoneValue | undefined;
  guild: string;
  age: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
}

const INITIAL: FormData = {
  playerName: "",
  email: "",
  whatsapp: undefined,
  guild: "",
  age: "",
  password: "",
  confirmPassword: "",
  rememberMe: false,
};

// ── Page ───────────────────────────────────────────────────────────
export default function Register() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Client-side validation ─────────────────────────────────────
  const validate = (): string | null => {
    if (!form.playerName.trim()) return "Player name is required.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return "A valid email is required.";
    if (!form.whatsapp) return "WhatsApp number is required.";
    if (!form.guild) return "Please choose a guild.";
    const age = parseInt(form.age, 10);
    if (!form.age || isNaN(age) || age < 13 || age > 120)
      return "Age must be between 13 and 120.";
    if (form.password.length < 8)
      return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword)
      return "Passwords do not match.";
    return null;
  };

  // ── Submit ─────────────────────────────────────────────────────
  // Backend contract (not wired yet):
  //   POST /api/auth/register
  //   Body: { playerName, email, whatsapp, guild, age, password, rememberMe }
  //   → 200 { userId, token? } or 400 { error: string }
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      // TODO: wire up to real endpoint
      // const res = await fetch("/api/auth/register", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     playerName: form.playerName.trim(),
      //     email: form.email.trim().toLowerCase(),
      //     whatsapp: form.whatsapp,
      //     guild: form.guild,
      //     age: parseInt(form.age, 10),
      //     password: form.password,
      //     rememberMe: form.rememberMe,
      //   }),
      // });
      // if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await new Promise((r) => setTimeout(r, 700)); // simulated
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────
  if (success) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8">
        <div className="absolute inset-0 overlay-theme-heavy" />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-astral-gold/40 bg-astral-gold/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="h-8 w-8 text-astral-gold" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="theme-heading text-2xl font-bold uppercase tracking-widest" style={{ fontFamily: "serif" }}>
            Welcome, {form.playerName}!
          </h1>
          <p className="theme-body text-sm leading-7">
            Your account has been created. A confirmation will be sent to your WhatsApp shortly.
          </p>
          <Link
            href="/"
            className="flex h-12 w-full items-center justify-center border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white"
          >
            Back to Home
          </Link>
        </section>
      </main>
    );
  }

  // ── Main form ──────────────────────────────────────────────────
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 overlay-theme-heavy" />

      <section className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">

        {/* ── Left: branding ── */}
        <div className="flex flex-col justify-center text-center lg:text-left">
          <Link
            href="/"
            className="mb-8 inline-flex w-fit items-center self-center text-sm font-semibold uppercase tracking-widest text-astral-gold transition-colors hover:text-white lg:self-start"
          >
            ← Back to home
          </Link>

          <Image
            src="/brand/logo.png?v=transparent-1"
            alt="Astral Legacy"
            width={104}
            height={104}
            className="logo-filter mb-6 h-auto w-24 self-center lg:self-start"
            priority
            unoptimized
          />

          <h1
            className="theme-heading mb-4 text-3xl font-bold uppercase tracking-widest sm:text-4xl md:text-5xl"
            style={{ fontFamily: "serif" }}
          >
            Start Your Legacy
          </h1>

          <p className="theme-body mx-auto max-w-xl text-base leading-7 md:text-lg lg:mx-0">
            Create your companion profile for card claims, live auctions, guild
            events, and WhatsApp-linked rewards.
          </p>
        </div>

        {/* ── Right: form ── */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="form-card w-full border p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-6 md:p-8"
        >
          <div className="grid gap-5">

            {/* Player name */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                Player Name
              </span>
              <input
                type="text"
                name="playerName"
                value={form.playerName}
                onChange={(e) => set("playerName", e.target.value)}
                required
                placeholder="StarHunter99"
                autoComplete="username"
                className="form-input h-12 border px-4 outline-none transition-colors placeholder:text-gray-500 focus:border-astral-gold"
              />
            </label>

            {/* Email */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                Email
              </span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
                className="form-input h-12 border px-4 outline-none transition-colors placeholder:text-gray-500 focus:border-astral-gold"
              />
            </label>

            {/* WhatsApp — phone picker */}
            <div className="grid gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                WhatsApp Number
              </span>
              <PhoneField
                value={form.whatsapp}
                onChange={(v) => set("whatsapp", v)}
                name="whatsapp"
                required
              />
              <p className="text-xs text-gray-500">
                Select your country flag to change the dialling code.
              </p>
            </div>

            {/* Guild + Age — two columns on wider screens */}
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                  Guild
                </span>
                <select
                  name="guild"
                  value={form.guild}
                  onChange={(e) => set("guild", e.target.value)}
                  required
                  className="form-select h-12 border px-4 outline-none transition-colors focus:border-astral-gold"
                >
                  <option value="" disabled>Choose a guild</option>
                  <option value="solaris">Solaris</option>
                  <option value="nocturne">Nocturne</option>
                  <option value="eclipse">Eclipse</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                  Age
                </span>
                <input
                  type="number"
                  name="age"
                  value={form.age}
                  onChange={(e) => set("age", e.target.value)}
                  required
                  min={13}
                  max={120}
                  placeholder="18"
                  className="form-input h-12 border px-4 outline-none transition-colors placeholder:text-gray-500 focus:border-astral-gold"
                />
              </label>
            </div>

            {/* Password fields */}
            <PasswordField
              label="Password"
              name="password"
              value={form.password}
              onChange={(v) => set("password", v)}
              required
              showStrength
            />

            <PasswordField
              label="Confirm Password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={(v) => set("confirmPassword", v)}
              required
              matchValue={form.password}
            />

          </div>

          {/* Remember me + forgot password row */}
          <div className="mt-5 flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="rememberMe"
                checked={form.rememberMe}
                onChange={(e) => set("rememberMe", e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-astral-gold"
              />
              <span className="text-sm text-gray-400">Remember me</span>
            </label>

            <Link
              href="/forgot-password"
              className="text-sm font-medium text-astral-gold transition-colors hover:text-white"
            >
              Forgot password?
            </Link>
          </div>

          {/* Error message */}
          {error && (
            <p className="mt-4 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 h-12 w-full border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating Account…" : "Create Account"}
          </button>

          <p className="mt-4 text-center text-xs text-gray-500">
            By registering you agree to our{" "}
            <button
              type="button"
              onClick={() => setTosOpen(true)}
              className="font-semibold text-astral-gold underline underline-offset-2 transition-colors hover:text-white"
            >
              Terms of Service &amp; Privacy Policy
            </button>
            .
          </p>
        </form>
      </section>

      <TosModal open={tosOpen} onClose={() => setTosOpen(false)} />
    </main>
  );
}
