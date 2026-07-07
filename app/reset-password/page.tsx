"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, KeyboardEvent, ClipboardEvent, Suspense } from "react";
import { PasswordField } from "../components/PasswordField";

// ── OTP Config ─────────────────────────────────────────────────────
const OTP_LENGTH = 6;

// ── Types ──────────────────────────────────────────────────────────
type Stage = "otp" | "newPassword" | "done";

// ── Main inner component (needs useSearchParams) ───────────────────
function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  // Stage state
  const [stage, setStage] = useState<Stage>("otp");

  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Password state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // ── OTP helpers ──────────────────────────────────────────────────
  const handleOtpChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtp(next);
    // Focus last filled or last box
    const lastIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastIdx]?.focus();
  };

  const otpFilled = otp.every(Boolean);

  // ── OTP submit ───────────────────────────────────────────────────
  // Backend contract (not wired yet):
  //   POST /api/auth/verify-otp  { otp: "123456", token?: string }
  //   → 200 { verified: true } or 400 { error: "Invalid OTP" }
  const handleVerifyOtp = async () => {
    if (!otpFilled) return;
    setOtpError("");
    setOtpLoading(true);
    try {
      // TODO: replace with real fetch
      // const res = await fetch("/api/auth/verify-otp", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ otp: otp.join(""), token }),
      // });
      // if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await new Promise((r) => setTimeout(r, 600)); // simulated delay
      setStage("newPassword");
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Invalid OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Password submit ──────────────────────────────────────────────
  // Backend contract (not wired yet):
  //   POST /api/auth/reset-password  { token, otp, newPassword }
  //   → 200 { success: true } or 400 { error: "..." }
  const handleResetPassword = async () => {
    setPwError("");
    if (password.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwLoading(true);
    try {
      // TODO: replace with real fetch
      // const res = await fetch("/api/auth/reset-password", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ token, otp: otp.join(""), newPassword: password }),
      // });
      // if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await new Promise((r) => setTimeout(r, 600)); // simulated delay
      setStage("done");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Reset failed. Please try again.");
    } finally {
      setPwLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8 sm:px-6">
      <div className="absolute inset-0 overlay-theme-heavy" />

      <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <Link
          href="/forgot-password"
          className="mb-8 self-start text-sm font-semibold uppercase tracking-widest text-astral-gold transition-colors hover:text-white"
        >
          ← Back
        </Link>

        <Image
          src="/brand/logo.png?v=transparent-1"
          alt="Astral Legacy"
          width={80}
          height={80}
          className="logo-filter mb-6 h-auto w-16"
          priority
          unoptimized
        />

        {/* ── Stage: OTP entry ── */}
        {stage === "otp" && (
          <>
            <h1
              className="theme-heading mb-3 text-2xl font-bold uppercase tracking-widest sm:text-3xl"
              style={{ fontFamily: "serif" }}
            >
              Enter Your Code
            </h1>
            <p className="theme-body mb-8 text-sm leading-7 sm:text-base">
              Enter the {OTP_LENGTH}-digit code sent by our WhatsApp bot.
              {token && (
                <span className="block mt-1 text-xs text-gray-500">
                  Session token detected ✓
                </span>
              )}
            </p>

            {/* OTP boxes */}
            <div
              className="mb-6 flex gap-2 sm:gap-3"
              role="group"
              aria-label="One-time password"
            >
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  aria-label={`Digit ${i + 1}`}
                  className="
                    form-input h-12 w-12 border text-center text-xl font-bold
                    outline-none transition-all
                    focus:border-astral-gold focus:scale-105
                    sm:h-14 sm:w-14 sm:text-2xl
                  "
                />
              ))}
            </div>

            {otpError && (
              <p className="mb-4 text-sm text-red-400">{otpError}</p>
            )}

            <button
              type="button"
              disabled={!otpFilled || otpLoading}
              onClick={handleVerifyOtp}
              className="h-12 w-full border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {otpLoading ? "Verifying…" : "Verify Code"}
            </button>

            <p className="mt-6 text-sm text-gray-500">
              Didn&apos;t receive a code?{" "}
              <Link
                href="/forgot-password"
                className="font-semibold text-astral-gold hover:text-white transition-colors"
              >
                Resend via WhatsApp
              </Link>
            </p>
          </>
        )}

        {/* ── Stage: New password ── */}
        {stage === "newPassword" && (
          <>
            <h1
              className="theme-heading mb-3 text-2xl font-bold uppercase tracking-widest sm:text-3xl"
              style={{ fontFamily: "serif" }}
            >
              New Password
            </h1>
            <p className="theme-body mb-8 text-sm leading-7 sm:text-base">
              Code verified. Choose a strong new password.
            </p>

            <div className="w-full grid gap-5 text-left">
              <PasswordField
                label="New Password"
                name="password"
                value={password}
                onChange={setPassword}
                required
                showStrength
              />
              <PasswordField
                label="Confirm Password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                matchValue={password}
              />
            </div>

            {pwError && (
              <p className="mt-4 text-sm text-red-400">{pwError}</p>
            )}

            <button
              type="button"
              disabled={!password || !confirmPassword || pwLoading}
              onClick={handleResetPassword}
              className="mt-6 h-12 w-full border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pwLoading ? "Saving…" : "Reset Password"}
            </button>
          </>
        )}

        {/* ── Stage: Done ── */}
        {stage === "done" && (
          <>
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-green-500/40 bg-green-500/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8 text-green-400"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h1
              className="theme-heading mb-3 text-2xl font-bold uppercase tracking-widest sm:text-3xl"
              style={{ fontFamily: "serif" }}
            >
              Password Reset
            </h1>
            <p className="theme-body mb-8 text-sm leading-7 sm:text-base">
              Your password has been updated successfully. You can now log in.
            </p>

            <Link
              href="/register"
              className="flex h-12 w-full items-center justify-center border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white"
            >
              Back to Login
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

// ── Wrap in Suspense (required for useSearchParams in App Router) ──
export default function ResetPassword() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
