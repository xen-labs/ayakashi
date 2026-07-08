"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState, FormEvent, Suspense } from "react";
import { type Value as PhoneValue } from "react-phone-number-input";
import { PhoneField } from "../components/PhoneField";
import { PasswordField } from "../components/PasswordField";
import { TosModal } from "../components/TosModal";
import { BackToWhatsApp } from "../components/BackToWhatsApp";
import { authRegister, ApiResponseError } from "../../lib/api";

// ── Form state ─────────────────────────────────────────────────────
interface FormData {
  phone: PhoneValue | undefined;
  password: string;
  confirmPassword: string;
  age: string;
}

const INITIAL: FormData = {
  phone: undefined,
  password: "",
  confirmPassword: "",
  age: "",
};

// ── Field-level errors map ─────────────────────────────────────────
interface FieldErrors {
  phone?: string;
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
  const [successHandle, setSuccessHandle] = useState<string | null>(null);
  const [tosOpen, setTosOpen] = useState(false);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear that field's error on change
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

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
    if (!form.phone) errors.phone = "Phone number is required.";
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
        phone: form.phone as string,
        password: form.password,
        age: parseInt(form.age, 10),
      });
      setSuccessHandle(data.handle);
    } catch (err) {
      if (err instanceof ApiResponseError) {
        const { code, message, issues } = err.error;

        // Dead-end states — swap the whole page
        if (
          code === "invalid_token" ||
          code === "token_expired" ||
          code === "token_used"
        ) {
          // Render the dead-end via a state flag; we keep hooks above
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

        // Phone already in use — inline under phone field
        if (code === "phone_in_use") {
          setFieldErrors({ phone: "This phone number is already registered." });
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
  if (successHandle) {
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
            Welcome!
          </h1>
          <p className="theme-body text-sm leading-7">
            Your account has been created. Your handle is{" "}
            <span className="font-bold text-astral-gold">{successHandle}</span>
            . You can customise it later in your profile.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="flex h-12 w-full items-center justify-center border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white"
          >
            Go to Login
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

            {/* Phone number */}
            <div className="grid gap-2">
              <span className="text-sm font-semibold uppercase tracking-widest text-astral-gold">
                Phone Number
              </span>
              <PhoneField
                value={form.phone}
                onChange={(v) => set("phone", v)}
                name="phone"
                required
              />
              {fieldErrors.phone && (
                <p className="text-xs text-red-400">{fieldErrors.phone}</p>
              )}
              <p className="text-xs text-gray-500">
                Select your country flag to change the dialling code.
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
                onChange={(e) => set("age", e.target.value)}
                required
                min={13}
                max={120}
                placeholder="18"
                className="form-input h-12 border px-4 outline-none transition-colors placeholder:text-gray-500 focus:border-astral-gold"
              />
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
