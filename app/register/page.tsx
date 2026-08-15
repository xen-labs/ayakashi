"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, FormEvent, Suspense } from "react";
import { PasswordField } from "../components/PasswordField";
import { TosModal } from "../components/TosModal";
import { BackToWhatsApp } from "../components/BackToWhatsApp";
import { EmberField } from "../components/EmberField";
import { CurrencyIcon } from "../components/CurrencyIcon";
import { useCountUp } from "../hooks/useCountUp";
import {
  authRegister,
  checkUsernameAvailable,
  ApiResponseError,
} from "../../lib/api";

const USERNAME_RE = /^[a-z0-9_]+$/;
function validateUsernameFormat(v: string): string | null {
  if (v.length < 3) return "Username must be at least 3 characters.";
  if (v.length > 20) return "Username must be at most 20 characters.";
  if (!USERNAME_RE.test(v))
    return "Only lowercase letters, numbers, and underscores allowed.";
  return null;
}

type AvailState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken"; suggestions: string[] }
  | { status: "error" };

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

/** One side of the welcome bonus card: icon, count-up number, radial burst. */
function RewardStat({
  type,
  amount,
  label,
  delay,
}: {
  type: "ryo" | "kitsu";
  amount: number;
  label: string;
  delay: number;
}) {
  const { value, done } = useCountUp(amount, { duration: 900, delay });
  const burstAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      <div className="relative flex h-9 w-9 items-center justify-center">
        {!done &&
          burstAngles.map((angle) => (
            <span
              key={angle}
              className="coin-burst-spark"
              style={
                {
                  "--burst-angle": `${angle}deg`,
                  animationDelay: `${delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        <CurrencyIcon type={type} size={30} className="coin-float" />
      </div>
      <span
        className={`font-display text-2xl font-bold text-[#c8a84b] tabular-nums ${
          done ? "stat-glow" : "count-up-active"
        }`}
      >
        +{value.toLocaleString("en-US")}
      </span>
      <span className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.5)]">
        {label}
      </span>
    </div>
  );
}

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
    welcomeBonus: { ryo: number; kitsu: number } | null;
  } | null>(null);
  const [tosOpen, setTosOpen] = useState(false);
  const [avail, setAvail] = useState<AvailState>({ status: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  useEffect(() => {
    const raw = form.username.trim().toLowerCase();
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
        setAvail(
          res.available
            ? { status: "available" }
            : { status: "taken", suggestions: res.suggestions },
        );
      } catch {
        setAvail({ status: "error" });
      }
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.username]);

  if (!token)
    return (
      <BackToWhatsApp
        heading="Link Not Valid"
        body="This registration link isn't valid. Go back to WhatsApp and run .register to get a fresh link."
        prefill="register"
      />
    );

  const validate = (): FieldErrors | null => {
    const errors: FieldErrors = {};
    const usernameErr = validateUsernameFormat(
      form.username.trim().toLowerCase(),
    );
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
      setSuccessData({
        username: data.username,
        displayName: data.displayName,
        welcomeBonus: data.welcomeBonus,
      });
    } catch (err) {
      if (err instanceof ApiResponseError) {
        const { code, message, issues } = err.error;
        if (
          code === "invalid_token" ||
          code === "token_expired" ||
          code === "token_used"
        ) {
          setGlobalError(`__dead_end__:${code}`);
          return;
        }
        if (code === "validation_error" && issues?.length) {
          const mapped: FieldErrors = {};
          for (const issue of issues) {
            const field = issue.path[0] as keyof FieldErrors;
            if (field in INITIAL) mapped[field] = issue.message;
          }
          setFieldErrors(mapped);
          return;
        }
        if (code === "username_taken") {
          setFieldErrors({
            username: "This username was just taken — try another.",
          });
          return;
        }
        if (code === "already_registered") {
          setGlobalError(
            "You already have an account — try logging in instead.",
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

  if (globalError === "__dead_end__:invalid_token")
    return (
      <BackToWhatsApp
        heading="Link Not Valid"
        body="This registration link isn't valid. Go back to WhatsApp and run .register again."
        prefill="register"
      />
    );
  if (globalError === "__dead_end__:token_expired")
    return (
      <BackToWhatsApp
        heading="Link Expired"
        body="This link expired. Run .register again in WhatsApp to get a new one."
        prefill="register"
      />
    );
  if (globalError === "__dead_end__:token_used")
    return (
      <BackToWhatsApp
        heading="Link Already Used"
        body="This link was already used. If that wasn't you, run .register again for a new link."
        prefill="register"
      />
    );

  // ── Success ──
  if (successData) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-8">
        <div className="pointer-events-none fixed left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(200,168,75,0.05)] blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2">
          <div className="hero-ray-sweep absolute inset-0 rounded-full" />
        </div>
        <EmberField count={16} />

        <section className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 text-center">
          <div
            className="coin-medallion h-20 w-20 stagger-in"
            style={{ animationDelay: "0.05s" }}
          >
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
            className="font-display text-2xl font-bold uppercase tracking-[0.05em] text-[#f0e6c8] stagger-in"
            style={{ animationDelay: "0.15s" }}
          >
            Welcome, {successData.displayName}!
          </h1>
          <p
            className="text-sm leading-7 text-[#a89880] stagger-in"
            style={{ animationDelay: "0.25s" }}
          >
            Your account is ready. Username:{" "}
            <span className="font-bold text-[#c8a84b]">
              @{successData.username}
            </span>
          </p>
          {successData.welcomeBonus && (
            <div
              className="welcome-bonus-card relative w-full overflow-hidden border border-[rgba(200,168,75,0.4)] bg-black/40 px-6 py-5"
              style={{ animationDelay: "0.35s" }}
            >
              <div className="welcome-bonus-shimmer pointer-events-none absolute inset-0" />
              <p className="relative z-10 text-xs font-bold uppercase tracking-[0.2em] text-[#c8a84b]">
                ✦ Welcome Bonus ✦
              </p>
              <div className="relative z-10 mt-3 flex items-center justify-center gap-8">
                <RewardStat
                  type="ryo"
                  amount={successData.welcomeBonus.ryo}
                  label="Ryo"
                  delay={450}
                />
                <div className="h-10 w-px bg-[rgba(200,168,75,0.2)]" />
                <RewardStat
                  type="kitsu"
                  amount={successData.welcomeBonus.kitsu}
                  label="Kitsu"
                  delay={600}
                />
              </div>
            </div>
          )}
          <div
            className="flex justify-center stagger-in"
            style={{ animationDelay: "0.75s" }}
          >
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="brush-btn brush-btn-glint w-52"
            >
              Go to Dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ── Main form ──
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(200,168,75,0.04)] blur-[120px]" />
      <EmberField count={12} />

      <section className="relative z-10 grid w-full max-w-5xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        {/* ── Left: branding ── */}
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <Link
            href="/"
            className="stagger-in text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(200,168,75,0.55)] transition-colors hover:text-[#c8a84b]"
          >
            ← Back
          </Link>
          <Image
            src="/brand/logo.png?v=transparent-1"
            alt="Ayakashi"
            width={80}
            height={80}
            className="logo-entrance h-auto w-20"
            priority
            unoptimized
          />
          <div className="stagger-in" style={{ animationDelay: "0.15s" }}>
            <h1 className="font-display text-3xl font-bold uppercase tracking-[0.05em] text-[#f0e6c8] sm:text-4xl md:text-5xl">
              Start Your Legacy
            </h1>
            <div className="mt-2 h-px w-24 bg-gradient-to-r from-[#c8a84b] to-transparent lg:max-w-[200px]" />
          </div>
          <p
            className="stagger-in max-w-sm text-sm leading-7 text-[#a89880]"
            style={{ animationDelay: "0.25s" }}
          >
            Create your companion profile for card claims, live auctions, guild
            events, and WhatsApp-linked rewards.
          </p>
          <p
            className="stagger-in text-xs text-[rgba(200,168,75,0.35)] uppercase tracking-[0.15em]"
            style={{ animationDelay: "0.35s" }}
          >
            ✦ &nbsp; Ayakashi &nbsp; ✦
          </p>
        </div>

        {/* ── Right: form ── */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="form-card stagger-in w-full border p-6 sm:p-8"
          style={{ animationDelay: "0.2s" }}
        >
          {/* form header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(200,168,75,0.3)]" />
            <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[#c8a84b]">
              Create Account
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(200,168,75,0.3)]" />
          </div>

          <div className="grid gap-5">
            {/* Username */}
            <div className="grid gap-2">
              <span className="font-ui text-xs font-semibold uppercase tracking-[0.15em] text-[rgba(200,168,75,0.7)]">
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
                  autoFocus
                  className="form-input form-input-glow h-12 w-full border px-4 pr-10 outline-none transition-colors placeholder:text-[rgba(200,168,75,0.2)] focus:border-[#c8a84b]"
                />
                <span
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                >
                  {avail.status === "checking" && (
                    <svg
                      className="h-4 w-4 animate-spin text-[rgba(200,168,75,0.6)]"
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
              {avail.status === "available" && (
                <p className="text-xs text-green-400">Username is available.</p>
              )}
              {avail.status === "taken" && (
                <p className="text-xs text-red-400">Username is taken.</p>
              )}
              {avail.status === "error" && (
                <p className="text-xs text-yellow-400">
                  Couldn&apos;t check availability — try again.
                </p>
              )}
              {fieldErrors.username && (
                <p className="text-xs text-red-400">{fieldErrors.username}</p>
              )}
              {avail.status === "taken" && avail.suggestions.length > 0 && (
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Username suggestions"
                >
                  {avail.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        set("username", s);
                        setFieldErrors((p) => ({ ...p, username: undefined }));
                      }}
                      className="border border-[rgba(200,168,75,0.35)] bg-[rgba(200,168,75,0.08)] px-2.5 py-1 text-xs font-mono text-[#c8a84b] transition-colors hover:bg-[rgba(200,168,75,0.16)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-[rgba(200,168,75,0.30)]">
                3–20 chars. Lowercase, numbers, underscores only.
              </p>
            </div>

            {/* Age */}
            <label className="grid gap-2">
              <span className="font-ui text-xs font-semibold uppercase tracking-[0.15em] text-[rgba(200,168,75,0.7)]">
                Age
              </span>
              <input
                type="number"
                name="age"
                value={form.age}
                onChange={(e) =>
                  set("age", e.target.value.replace(/[^0-9]/g, ""))
                }
                onKeyDown={(e) => {
                  if (
                    !/[0-9]/.test(e.key) &&
                    ![
                      "Backspace",
                      "Delete",
                      "ArrowLeft",
                      "ArrowRight",
                      "Tab",
                    ].includes(e.key)
                  )
                    e.preventDefault();
                }}
                required
                min={13}
                max={120}
                placeholder="18"
                className="form-input form-input-glow h-12 border px-4 outline-none transition-colors placeholder:text-[rgba(200,168,75,0.2)] focus:border-[#c8a84b]"
              />
              {form.age && parseInt(form.age, 10) < 13 && (
                <p className="text-xs text-red-400">
                  You must be at least 13 years old.
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
              <p className="-mt-3 text-xs text-red-400">
                {fieldErrors.password}
              </p>
            )}

            {/* Confirm */}
            <PasswordField
              label="Confirm Password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={(v) => set("confirmPassword", v)}
              required
              matchValue={form.password}
            />
          </div>

          {globalError && !globalError.startsWith("__dead_end__") && (
            <div
              className="mt-5 border border-red-500/30 bg-red-500/10 px-4 py-3"
              role="alert"
            >
              <p className="text-xs text-red-400">
                {globalError}{" "}
                {globalError.includes("already have an account") && (
                  <Link
                    href="/login"
                    className="font-semibold text-[#c8a84b] hover:text-white transition-colors"
                  >
                    Log in →
                  </Link>
                )}
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              type="submit"
              disabled={
                loading ||
                (() => {
                  const age = parseInt(form.age, 10);
                  return (
                    form.age !== "" && (isNaN(age) || age < 13 || age > 120)
                  );
                })()
              }
              className="brush-btn brush-btn-glint w-56 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  Creating Account…
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-[rgba(200,168,75,0.30)]">
            By registering you agree to our{" "}
            <button
              type="button"
              onClick={() => setTosOpen(true)}
              className="text-[rgba(200,168,75,0.60)] underline underline-offset-2 transition-colors hover:text-[#c8a84b]"
            >
              Terms of Service &amp; Privacy Policy
            </button>
            .
          </p>
          <p className="mt-3 text-center text-xs text-[rgba(200,168,75,0.35)]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[rgba(200,168,75,0.60)] hover:text-[#c8a84b] transition-colors"
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

export default function Register() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  );
}
