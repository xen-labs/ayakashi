"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, FormEvent, Suspense } from "react";
import { PasswordField } from "../components/PasswordField";
import { TosModal } from "../components/TosModal";
import { BackToWhatsApp } from "../components/BackToWhatsApp";
import {
  authRegister,
  checkUsernameAvailable,
  ApiResponseError,
} from "../../lib/api";

// ── Username validation (client-side, mirrors backend rules) ──────
const USERNAME_RE = /^[a-z0-9_]+$/;
function validateUsernameFormat(v: string): string | null {
  if (v.length < 3) return "Username must be at least 3 characters.";
  if (v.length > 20) return "Username must be at most 20 characters.";
  if (!USERNAME_RE.test(v))
    return "Only lowercase letters, numbers, and underscores allowed.";
  return null;
}

// ── Availability state ─────────────────────────────────────────────
type AvailState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken"; suggestions: string[] }
  | { status: "error" };

// ── Form state ─────────────────────────────────────────────────────
interface FormData {
  username: string;
  password: string;
  confirmPassword: string;
  age: string;
}

const INITIAL: FormData = {
  username: "",
  password: "",
  confirmPassword: "",
  age: "",
};

interface FieldErrors {
  username?: string;
  password?: string;
  age?: string;
}

// ── Inner component (uses useSearchParams — must be inside Suspense) ─
function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [form, setForm] = useState<FormData>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{
    username: string;
    displayName: string;
  } | null>(null);
  const [tosOpen, setTosOpen] = useState(false);
  const [avail, setAvail] = useState<AvailState>({ status: "idle" });

  // Debounce ref for username availability check
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // ── Live username availability ─────────────────────────────────
  useEffect(() => {
    const raw = form.username.trim().toLowerCase();

    // Reset to idle if empty or format is invalid
    if (!raw || validateUsernameFormat(raw) !== null) {
      setAvail({ status: "idle" });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    setAvail({ status: "checking" });
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailable(raw);
        if (res.available) {
          setAvail({ status: "available" });
        } else {
          setAvail({ status: "taken", suggestions: res.suggestions });
        }
      } catch {
        setAvail({ status: "error" });
      }
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.username]);

  // ── If there's no token at all, show dead-end immediately ─────────
  if (!token) {
    return (
      <BackToWhatsApp
        heading="Link Not Valid"
        body="This registration link isn't valid. Go back to WhatsApp and run .register to get a fresh link."
        prefill="register"
      />
    );
  }

  // ── Client-side validation ─────────────────────────────────────
  const validate = (): FieldErrors | null => {
    const errors: FieldErrors = {};
    const usernameErr = validateUsernameFormat(form.username.trim().toLowerCase());
    if (usernameErr) errors.username = usernameErr;
    if (form.password.length < 8)
      errors.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword)
      errors.password = "Passwords do not match.";
    const age = parseInt(form.age, 10);
    if (!form.age || isNaN(age) || age < 13 || age > 120)
      errors.age = "Age must be between 13 and 120.";
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
      const data = await authRegister({
        token,
        username: form.username.trim().toLowerCase(),
        password: form.password,
        age: parseInt(form.age, 10),
      });
      setSuccessData({ username: data.username, displayName: data.displayName });
    } catch (err) {
      if (err instanceof ApiResponseError) {
        const { code, message, issues } = err.error;

        // Dead-end states — swap the whole page
        if (
          code === "invalid_token" ||
          code === "token_expired" ||
          code === "token_used"
        ) {
          setGlobalError(`__dead_end__:${code}`);
          return;
        }

        // Field-level errors from validation_error
        if (code === "validation_error" && issues?.length) {
          const mapped: FieldErrors = {};
          for (const issue of issues) {
            const field = issue.path[0] as keyof FieldErrors;
            if (field in INITIAL) mapped[field] = issue.message;
          }
          setFieldErrors(mapped);
          return;
        }

        // Username race condition
        if (code === "username_taken") {
          setFieldErrors({
            username: "This username was just taken — try another.",
          });
          return;
        }

        // Already registered — prompt to login
        if (code === "already_registered") {
          setGlobalError(
            "You already have an account — try logging in instead."
          );
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
        body="This registration link isn't valid. Go back to WhatsApp and run .register again."
        prefill="register"
      />
    );
  }
  if (globalError === "__dead_end__:token_expired") {
    return (
      <BackToWhatsApp
        heading="Link Expired"
        body="This link expired. Run .register again in WhatsApp to get a new one."
        prefill="register"
      />
    );
  }
  if (globalError === "__dead_end__:token_used") {
    return (
      <BackToWhatsApp
        heading="Link Already Used"
        body="This link was already used. If that wasn't you, run .register again for a new link."
        prefill="register"
      />
    );
  }

  // ── Success screen ─────────────────────────────────────────────
  if (successData) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8">
        <div className="absolute inset-0 overlay-theme-heavy" />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-astral-gold/40 bg-astral-gold/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-astral-gold"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1
            className="theme-heading text-2xl font-bold uppercase tracking-widest"
            style={{ fontFamily: "serif" }}
          >
            Welcome, {successData.displayName}!
          </h1>
          <p className="theme-body text-sm leading-7">
            Your account has been created. Your username is{" "}
            <span className="font-bold text-astral-gold">
              @{successData.username}
            </span>
            .
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex h-12 w-full items-center justify-center border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white"
          >
            Go to Dashboard
          </button>
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

            {/* Username */}
            <div className="grid gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                Username
              </span>
              <div className="relative">
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="xenkai"
                  maxLength={20}
                  className="form-input h-12 w-full border px-4 pr-10 outline-none transition-colors placeholder:text-gray-500 focus:border-astral-gold"
                  aria-describedby="username-hint"
                />
                {/* Availability indicator */}
                <span
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                >
                  {avail.status === "checking" && (
                    <svg
                      className="h-4 w-4 animate-spin text-astral-gold/60"
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
                  )}
                  {avail.status === "available" && (
                    <svg
                      className="h-4 w-4 text-green-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {(avail.status === "taken" || avail.status === "error") && (
                    <svg
                      className="h-4 w-4 text-red-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </span>
              </div>

              {/* Availability text */}
              {avail.status === "available" && (
                <p className="text-xs text-green-400">Username is available.</p>
              )}
              {avail.status === "taken" && (
                <p className="text-xs text-red-400">
                  Username is taken.
                </p>
              )}
              {avail.status === "error" && (
                <p className="text-xs text-yellow-400">
                  Couldn&apos;t check availability — try again.
                </p>
              )}
              {fieldErrors.username && (
                <p className="text-xs text-red-400">{fieldErrors.username}</p>
              )}

              {/* Suggestion chips */}
              {avail.status === "taken" && avail.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Username suggestions">
                  {avail.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        set("username", s);
                        setFieldErrors((prev) => ({ ...prev, username: undefined }));
                      }}
                      className="rounded-sm border border-astral-gold/40 bg-astral-gold/10 px-2.5 py-1 text-xs font-mono text-astral-gold transition-colors hover:bg-astral-gold/20"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <p id="username-hint" className="text-xs text-gray-500">
                3–20 characters. Lowercase letters, numbers, and underscores only.
              </p>
            </div>

            {/* Age */}
            <label className="grid gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                Age
              </span>
              <input
                type="number"
                name="age"
                value={form.age}
                onChange={(e) => {
                  // Strip anything that isn't a digit
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  set("age", raw);
                }}
                onKeyDown={(e) => {
                  // Block letters and symbols at the keyboard level
                  if (
                    !/[0-9]/.test(e.key) &&
                    !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)
                  ) {
                    e.preventDefault();
                  }
                }}
                required
                min={13}
                max={120}
                placeholder="18"
                className={`form-input h-12 border px-4 outline-none transition-colors placeholder:text-gray-500 focus:border-astral-gold ${
                  form.age && (parseInt(form.age, 10) < 13 || parseInt(form.age, 10) > 120)
                    ? "border-red-500"
                    : ""
                }`}
              />
              {form.age && parseInt(form.age, 10) < 13 && (
                <p className="text-xs text-red-400">
                  You must be at least 13 years old to register.
                </p>
              )}
              {form.age && parseInt(form.age, 10) > 120 && (
                <p className="text-xs text-red-400">
                  Please enter a valid age.
                </p>
              )}
              {fieldErrors.age && (
                <p className="text-xs text-red-400">{fieldErrors.age}</p>
              )}
            </label>

            {/* Password */}
            <PasswordField
              label="Password"
              name="password"
              value={form.password}
              onChange={(v) => set("password", v)}
              required
              showStrength
            />
            {fieldErrors.password && (
              <p className="-mt-3 text-xs text-red-400">{fieldErrors.password}</p>
            )}

            {/* Confirm password */}
            <PasswordField
              label="Confirm Password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={(v) => set("confirmPassword", v)}
              required
              matchValue={form.password}
            />

          </div>

          {/* Already registered nudge or generic error */}
          {globalError && !globalError.startsWith("__dead_end__") && (
            <div className="mt-5 flex items-start gap-3 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">
                {globalError}{" "}
                {globalError.includes("already have an account") && (
                  <Link
                    href="/login"
                    className="font-semibold text-astral-gold hover:text-white transition-colors"
                  >
                    Log in →
                  </Link>
                )}
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={
              loading ||
              (() => {
                const age = parseInt(form.age, 10);
                return form.age !== "" && (isNaN(age) || age < 13 || age > 120);
              })()
            }
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

          <p className="mt-3 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-astral-gold hover:text-white transition-colors"
            >
              Log in →
            </Link>
          </p>
        </form>
      </section>

      <TosModal open={tosOpen} onClose={() => setTosOpen(false)} />
    </main>
  );
}

// ── Wrap in Suspense (required for useSearchParams in App Router) ──
export default function Register() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  );
}
