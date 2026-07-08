"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState, FormEvent, Suspense } from "react";
import { PasswordField } from "../components/PasswordField";
import { BackToWhatsApp } from "../components/BackToWhatsApp";
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
      // API logs the user out everywhere on success — redirect to login
      // with a success message via search param
      router.push("/login?reset=1");
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

  // ── Main form ──────────────────────────────────────────────────
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8 sm:px-6">
      <div className="absolute inset-0 overlay-theme-heavy" />

      <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <Link
          href="/"
          className="mb-8 self-start text-sm font-semibold uppercase tracking-widest text-astral-gold transition-colors hover:text-white"
        >
          ← Back to home
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

        <h1
          className="theme-heading mb-3 text-2xl font-bold uppercase tracking-widest sm:text-3xl"
          style={{ fontFamily: "serif" }}
        >
          Set New Password
        </h1>

        <p className="theme-body mb-8 text-sm leading-7 sm:text-base">
          Choose a strong new password for your account.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="w-full grid gap-5 text-left"
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
            <p className="rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {globalError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="h-12 w-full border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving…" : "Reset Password"}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-semibold text-astral-gold hover:text-white transition-colors"
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
