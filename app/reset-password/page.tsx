"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, FormEvent, Suspense } from "react";
import { PasswordField } from "../components/PasswordField";
import { BackToWhatsApp } from "../components/BackToWhatsApp";
import { EmberField } from "../components/EmberField";
import { FireSpinner } from "../components/FireSpinner";
import { authResetPassword, ApiResponseError } from "../../lib/api";

// ── Field errors ───────────────────────────────────────────────────
interface FieldErrors {
  newPassword?: string;
}

// ── Inner component (uses useSearchParams — must be inside Suspense) ─
function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Brief celebratory beat before handing off to login — long enough to
  // register, short enough not to feel like a delay.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => router.push("/login?reset=1"), 1400);
    return () => clearTimeout(t);
  }, [success, router]);

  // ── Dead-end: no token in URL ──────────────────────────────────
  if (!token) {
    return (
      <BackToWhatsApp
        heading="Link Not Valid"
        body="This reset link isn't valid. Open WhatsApp, message the bot, and request a new one."
        prefill="recover"
      />
    );
  }

  // ── Client-side validation ─────────────────────────────────────
  const validate = (): FieldErrors | null => {
    const errors: FieldErrors = {};
    if (password.length < 8)
      errors.newPassword = "Password must be at least 8 characters.";
    else if (password !== confirmPassword)
      errors.newPassword = "Passwords do not match.";
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
      await authResetPassword({ token, newPassword: password });
      // API logs the user out everywhere on success — show a confirmation
      // beat, then redirect to login.
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiResponseError) {
        const { code, message, issues } = err.error;

        // Dead-end states — swap the whole page
        if (code === "invalid_token") {
          setGlobalError("__dead_end__:invalid_token");
          return;
        }
        if (code === "token_used") {
          setGlobalError("__dead_end__:token_used");
          return;
        }
        if (code === "token_expired") {
          setGlobalError("__dead_end__:token_expired");
          return;
        }
        if (code === "account_not_found") {
          setGlobalError("__dead_end__:account_not_found");
          return;
        }

        if (code === "validation_error" && issues?.length) {
          const mapped: FieldErrors = {};
          for (const issue of issues) {
            if (issue.path[0] === "newPassword")
              mapped.newPassword = issue.message;
          }
          setFieldErrors(mapped);
          return;
        }

        setGlobalError(message ?? "Something went wrong. Please try again.");
      } else {
        setGlobalError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Dead-end states triggered after submit ────────────────────
  if (globalError === "__dead_end__:invalid_token") {
    return (
      <BackToWhatsApp
        heading="Link Not Valid"
        body="This reset link isn't valid — request a new one via WhatsApp."
        prefill="recover"
      />
    );
  }
  if (globalError === "__dead_end__:token_used") {
    return (
      <BackToWhatsApp
        heading="Link Already Used"
        body="This link was already used. Request a new password reset via WhatsApp."
        prefill="recover"
      />
    );
  }
  if (globalError === "__dead_end__:token_expired") {
    return (
      <BackToWhatsApp
        heading="Link Expired"
        body="This link has expired — request a new one via WhatsApp."
        prefill="recover"
      />
    );
  }
  if (globalError === "__dead_end__:account_not_found") {
    return (
      <BackToWhatsApp
        heading="Something Went Wrong"
        body="We couldn't find your account. Please contact support via WhatsApp."
        prefill="recover"
      />
    );
  }

  // ── Success beat — brief confirmation before redirecting ────────
  if (success) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-10 sm:px-6">
        <div className="pointer-events-none fixed left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(200,168,75,0.05)] blur-[100px]" />
        <EmberField count={14} />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 text-center">
          <div className="coin-medallion stagger-in h-20 w-20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-[#c8a84b]"
              aria-hidden="true"
            >
              <polyline
                points="20 6 9 17 4 12"
                pathLength={24}
                strokeDasharray={24}
                className="checkmark-draw"
                style={{ "--checkmark-length": 24 } as React.CSSProperties}
              />
            </svg>
          </div>
          <h1
            className="font-display stagger-in text-2xl font-bold uppercase tracking-[0.05em] text-[#f0e6c8]"
            style={{ animationDelay: "0.15s" }}
          >
            Password Updated
          </h1>
          <p
            className="stagger-in text-sm leading-7 text-[#a89880]"
            style={{ animationDelay: "0.25s" }}
          >
            You&apos;ve been signed out everywhere for safety.
            <br />
            Taking you to login…
          </p>
        </section>
      </main>
    );
  }

  // ── Main form ──────────────────────────────────────────────────
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-10 sm:px-6">
      <div className="pointer-events-none fixed left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(200,168,75,0.04)] blur-[120px]" />
      <EmberField count={14} />

      <section className="form-card stagger-in relative z-10 flex w-full max-w-md flex-col items-center border p-6 text-center sm:p-8">
        <Link
          href="/"
          className="stagger-in mb-8 self-start text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(200,168,75,0.55)] transition-colors hover:text-[#c8a84b]"
        >
          ← Back to home
        </Link>

        <Image
          src="/brand/logo.png?v=transparent-1"
          alt="Ayakashi"
          width={80}
          height={80}
          className="logo-entrance mb-6 h-auto w-16"
          priority
          unoptimized
        />

        <h1
          className="font-display stagger-in mb-3 text-2xl font-bold uppercase tracking-[0.05em] text-[#f0e6c8] sm:text-3xl"
          style={{ animationDelay: "0.15s" }}
        >
          Set New Password
        </h1>
        <div
          className="stagger-in mb-8 h-px w-24 bg-gradient-to-r from-[#c8a84b] to-transparent"
          style={{ animationDelay: "0.2s" }}
        />

        <p
          className="stagger-in mb-8 text-sm leading-7 text-[#a89880]"
          style={{ animationDelay: "0.25s" }}
        >
          Choose a strong new password for your account.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="stagger-in grid w-full gap-5 text-left"
          style={{ animationDelay: "0.3s" }}
        >
          <PasswordField
            label="New Password"
            name="newPassword"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setFieldErrors({});
            }}
            required
            showStrength
          />

          <PasswordField
            label="Confirm Password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(v) => {
              setConfirmPassword(v);
              setFieldErrors({});
            }}
            required
            matchValue={password}
          />

          {fieldErrors.newPassword && (
            <p className="-mt-3 text-xs text-red-400">
              {fieldErrors.newPassword}
            </p>
          )}

          {globalError && !globalError.startsWith("__dead_end__") && (
            <p className="border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
              {globalError}
            </p>
          )}

          <div className="mt-1 flex justify-center">
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="brush-btn brush-btn-ember w-56 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <FireSpinner size={14} variant="dark" />
                  Saving…
                </span>
              ) : (
                "Reset Password"
              )}
            </button>
          </div>
        </form>

        <p
          className="stagger-in mt-6 text-xs text-[rgba(200,168,75,0.35)]"
          style={{ animationDelay: "0.4s" }}
        >
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-semibold text-[rgba(200,168,75,0.6)] transition-colors hover:text-[#c8a84b]"
          >
            Back to Login
          </Link>
        </p>
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
