import Image from "next/image";
import Link from "next/link";

// ── Config ─────────────────────────────────────────────────────────
// Replace this with your bot's WhatsApp number (E.164, no +)
const BOT_NUMBER = "919999999999";
const PREFILL_TEXT = "recover";
const WA_URL = `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(PREFILL_TEXT)}`;

// ── Page ───────────────────────────────────────────────────────────
export default function ForgotPassword() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8 sm:px-6">
      <div className="absolute inset-0 overlay-theme-heavy" />

      <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <Link
          href="/register"
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

        <h1
          className="theme-heading mb-3 text-2xl font-bold uppercase tracking-widest sm:text-3xl"
          style={{ fontFamily: "serif" }}
        >
          Forgot Password?
        </h1>

        <p className="theme-body mb-10 text-sm leading-7 sm:text-base">
          No worries. Message our WhatsApp bot and it will send you a one-time
          code to reset your password securely.
        </p>

        {/* Primary CTA — opens WhatsApp */}
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all hover:bg-white"
        >
          {/* WhatsApp icon inline SVG — no extra dep needed */}
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

        <p className="mt-6 text-xs text-gray-500">
          This opens WhatsApp with a pre-filled message to our bot.
          <br />
          You&apos;ll receive a one-time code to enter on the next page.
        </p>

        {/* Direct link to OTP page — useful once they have the code */}
        <p className="mt-4 text-sm text-gray-500">
          Already have a code?{" "}
          <Link
            href="/reset-password"
            className="font-semibold text-astral-gold hover:text-white transition-colors"
          >
            Enter it here →
          </Link>
        </p>
      </section>
    </main>
  );
}
