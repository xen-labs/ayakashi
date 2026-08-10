"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, FormEvent } from "react";
import { PasswordField } from "../components/PasswordField";
import { authLogin, getHomeStats, ApiResponseError } from "../../lib/api";

const BOT_NUMBER = process.env.NEXT_PUBLIC_BOT_NUMBER ?? "919999999999";
const FORGOT_WA_URL = `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent("recover")}`;

interface FormData {
  username: string;
  password: string;
  rememberMe: boolean;
}
const INITIAL: FormData = { username: "", password: "", rememberMe: false };
interface FieldErrors {
  username?: string;
  password?: string;
}

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [playerCount, setPlayerCount] = useState<number | null>(null);

  useEffect(() => {
    getHomeStats()
      .then((res) => setPlayerCount(res.totalPlayers))
      .catch(() => null);
  }, []);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setGlobalError("");
  };

  const validate = (): FieldErrors | null => {
    const errors: FieldErrors = {};
    if (!form.username.trim()) errors.username = "Username is required.";
    if (!form.password) errors.password = "Password is required.";
    return Object.keys(errors).length ? errors : null;
  };

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
      router.push("/dashboard");
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
          setGlobalError("Invalid username or password.");
          return;
        }
        if (code === "account_locked") {
          setGlobalError(
            message ?? "Too many failed attempts. Please try again later.",
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

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-10 sm:px-6 lg:px-8">
      {/* ambient gold glow */}
      <div className="pointer-events-none fixed left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(200,168,75,0.04)] blur-[120px]" />

      <section className="relative z-10 grid w-full max-w-5xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        {/* ── Left: branding ── */}
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(200,168,75,0.55)] transition-colors hover:text-[#c8a84b]"
          >
            ← Back
          </Link>

          <Image
            src="/brand/logo.png?v=transparent-1"
            alt="Ayakashi"
            width={80}
            height={80}
            className="logo-filter h-auto w-20"
            priority
            unoptimized
          />

          <div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-[0.05em] text-[#f0e6c8] sm:text-4xl md:text-5xl">
              Welcome Back
            </h1>
            <div className="mt-2 h-px w-24 bg-gradient-to-r from-[#c8a84b] to-transparent lg:w-full lg:max-w-[200px]" />
          </div>

          <p className="max-w-sm text-sm leading-7 text-[#a89880]">
            Sign in to access your card collection, live auctions, guild events,
            and WhatsApp-linked rewards.
          </p>

          {/* Live player count — quiet social proof, only shown once loaded */}
          {playerCount !== null && (
            <div className="flex items-center gap-2 text-xs text-[rgba(200,168,75,0.5)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c8a84b] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#c8a84b]" />
              </span>
              <span>
                {playerCount.toLocaleString("en-US")} players in the network
              </span>
            </div>
          )}

          <p className="text-xs text-[rgba(200,168,75,0.35)] uppercase tracking-[0.15em]">
            ✦ &nbsp; Ayakashi &nbsp; ✦
          </p>
        </div>

        {/* ── Right: form ── */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="form-card w-full border p-6 sm:p-8"
        >
          {/* form header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(200,168,75,0.3)]" />
            <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[#c8a84b]">
              Sign In
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(200,168,75,0.3)]" />
          </div>

          <div className="grid gap-5">
            {/* Username */}
            <label className="grid gap-2">
              <span className="font-ui text-xs font-semibold uppercase tracking-[0.15em] text-[rgba(200,168,75,0.7)]">
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
                autoFocus
                className="form-input h-12 border px-4 outline-none transition-colors placeholder:text-[rgba(200,168,75,0.2)] focus:border-[#c8a84b]"
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

          {/* Remember + forgot */}
          <div className="mt-5 flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="rememberMe"
                checked={form.rememberMe}
                onChange={(e) => set("rememberMe", e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[#c8a84b]"
              />
              <span className="text-xs text-[rgba(200,168,75,0.5)]">
                Remember me
              </span>
            </label>
            <a
              href={FORGOT_WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[rgba(200,168,75,0.6)] transition-colors hover:text-[#c8a84b]"
            >
              Forgot password?
            </a>
          </div>

          {globalError && (
            <p
              className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400"
              role="alert"
            >
              {globalError}
            </p>
          )}

          {/* Submit — brush stroke button */}
          <div className="mt-6 flex justify-center">
            <button
              type="submit"
              disabled={loading}
              className="brush-btn w-56 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
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
                  Signing In…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-[rgba(200,168,75,0.35)]">
            No account?{" "}
            <span className="text-[rgba(200,168,75,0.55)]">
              Run <span className="font-mono text-[#c8a84b]">.register</span> in
              WhatsApp.
            </span>
          </p>
        </form>
      </section>
    </main>
  );
}
