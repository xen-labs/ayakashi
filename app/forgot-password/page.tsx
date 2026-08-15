import Image from "next/image";
import Link from "next/link";
import { EmberField } from "../components/EmberField";

// ── Config ─────────────────────────────────────────────────────────
// NEXT_PUBLIC_BOT_NUMBER must be set in .env.local / Vercel env vars —
// password recovery is DM-only (unlike registration, which happens via
// a .reg command in the hub group, so it doesn't need a bot number).
const BOT_NUMBER = process.env.NEXT_PUBLIC_BOT_NUMBER;
const PREFILL_TEXT = "recover";
const WA_URL = BOT_NUMBER
  ? `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(PREFILL_TEXT)}`
  : null;

// ── Page ───────────────────────────────────────────────────────────
export default function ForgotPassword() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-10 sm:px-6">
      <div className="pointer-events-none fixed left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(200,168,75,0.04)] blur-[120px]" />
      <EmberField count={14} />

      <section className="form-card stagger-in relative z-10 flex w-full max-w-md flex-col items-center border p-6 text-center sm:p-8">
        <Link
          href="/login"
          className="stagger-in mb-8 self-start text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(200,168,75,0.55)] transition-colors hover:text-[#c8a84b]"
        >
          ← Back to login
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
          className="stagger-in font-display mb-3 text-2xl font-bold uppercase tracking-[0.05em] text-[#f0e6c8] sm:text-3xl"
          style={{ animationDelay: "0.15s" }}
        >
          Forgot Password?
        </h1>
        <div
          className="stagger-in mb-6 h-px w-24 bg-gradient-to-r from-[#c8a84b] to-transparent"
          style={{ animationDelay: "0.2s" }}
        />

        <p
          className="stagger-in mb-10 text-sm leading-7 text-[#a89880]"
          style={{ animationDelay: "0.25s" }}
        >
          No worries. Message our WhatsApp bot and it will send you a secure
          link to reset your password.
        </p>

        {/* Primary CTA — opens WhatsApp DM to the bot for recovery.
            Falls back to the hub group if the bot number isn't
            configured, so the button is never a dead link. */}
        <a
          href={WA_URL ?? process.env.NEXT_PUBLIC_WA_HUB_URL ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="brush-btn brush-btn-ember stagger-in flex w-full items-center justify-center gap-2"
          style={{ animationDelay: "0.35s" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Continue via WhatsApp
        </a>

        <p
          className="stagger-in mt-6 text-xs text-[rgba(200,168,75,0.35)]"
          style={{ animationDelay: "0.45s" }}
        >
          This opens WhatsApp with a pre-filled message to our bot.
          <br />
          The bot will reply with a link — tap it to set your new password.
        </p>
      </section>
    </main>
  );
}
