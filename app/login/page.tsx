"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { PasswordField } from "../components/PasswordField";
import { authLogin, ApiResponseError } from "../../lib/api";

// ── Config ─────────────────────────────────────────────────────────
const BOT_NUMBER = process.env.NEXT_PUBLIC_BOT_NUMBER ?? "919999999999";
const FORGOT_WA_URL = `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent("recover")}`;

// ── Form state ─────────────────────────────────────────────────────
interface FormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

const INITIAL: FormData = {
  username: "",
  password: "",
  rememberMe: false,
};

interface FieldErrors {
  username?: string;
  password?: string;
}

// ── Page ───────────────────────────────────────────────────────────
export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setGlobalError("");
  };

  // ── Client-side validation ─────────────────────────────────────
  const validate = (): FieldErrors | null => {
    const errors: FieldErrors = {};
    if (!form.username.trim()) errors.username = "Username is required.";
    if (!form.password) errors.password = "Password is required.";
    return Object.keys(errors).length ? errors : null;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError("");
    setFieldErrors({});

    const clientErrors = validate();
    if (clientErrors) {
      setFieldErrors(clientErrors);
      return;
    }

    setLoading(true);
    try {
      await authLogin({
        username: form.username.trim().toLowerCase(),
        password: form.password,
        rememberMe: form.rememberMe,
      });
      // Cookies are set by the API — just redirect
      router.push("/");
    } catch (err) {
      if (err instanceof ApiResponseError) {
        const { code, message, issues } = err.error;

        if (code === "validation_error" && issues?.length) {
          const mapped: FieldErrors = {};
          for (const issue of issues) {
            const field = issue.path[0] as keyof FieldErrors;
            if (field === "username" || field === "password")
              mapped[field] = issue.message;
          }
          setFieldErrors(mapped);
          return;
        }

        if (code === "invalid_credentials") {
          // Deliberately vague — matches API security intent
          setGlobalError("Invalid username or password.");
          return;
        }

        if (code === "account_locked") {
          // message from API includes the wait time
          setGlobalError(
            message ?? "Too many failed attempts. Please try again later."
          );
          return;
        }

        setGlobalError(message ?? "Login failed. Please try again.");
      } else {
        setGlobalError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────
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
            alt="Ayakashi"
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
            Welcome Back
          </h1>

          <p className="theme-body mx-auto max-w-xl text-base leading-7 md:text-lg lg:mx-0">
            Sign in to access your card collection, live auctions, guild
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

            {/* Username */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                Username
              </span>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                required
                autoComplete="username"
                placeholder="xenkai"
                maxLength={20}
                className="form-input h-12 border px-4 outline-none transition-colors placeholder:text-gray-500 focus:border-astral-gold"
              />
              {fieldErrors.username && (
                <p className="text-xs text-red-400">{fieldErrors.username}</p>
              )}
            </label>

            {/* Password */}
            <div className="grid gap-2">
              <PasswordField
                label="Password"
                name="password"
                value={form.password}
                onChange={(v) => set("password", v)}
                required
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-400">{fieldErrors.password}</p>
              )}
            </div>

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

            <a
              href={FORGOT_WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-astral-gold transition-colors hover:text-white"
            >
              Forgot password?
            </a>
          </div>

          {/* Global error */}
          {globalError && (
            <p className="mt-4 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {globalError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 h-12 w-full border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing In…" : "Sign In"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <span className="text-xs text-gray-400">
              Get a registration link from WhatsApp — run{" "}
              <span className="font-mono text-astral-gold">.register</span> in
              any group.
            </span>
          </p>
        </form>
      </section>
    </main>
  );
}
