"use client";

import Image from "next/image";

// ── Config ─────────────────────────────────────────────────────────
const BOT_NUMBER = process.env.NEXT_PUBLIC_BOT_NUMBER ?? "919999999999";

interface BackToWhatsAppProps {
  /** Heading text shown on the dead-end screen */
  heading: string;
  /** Body copy — explain what went wrong */
  body: string;
  /** WhatsApp prefill text (default: "register") */
  prefill?: string;
}

/**
 * Full-page dead-end state used when a token is missing, invalid, expired,
 * or already used on /register and /reset-password.
 * The user's only path forward is back to WhatsApp.
 */
export function BackToWhatsApp({
  heading,
  body,
  prefill = "register",
}: BackToWhatsAppProps) {
  const waUrl = `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(prefill)}`;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8 sm:px-6">
      <div className="absolute inset-0 overlay-theme-heavy" />

      <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center gap-5">
        <Image
          src="/brand/logo.png?v=transparent-1"
          alt="Astral Legacy"
          width={80}
          height={80}
          className="logo-filter h-auto w-16"
          priority
          unoptimized
        />

        {/* Warning icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-astral-gold/40 bg-astral-gold/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-astral-gold"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h1
          className="theme-heading text-2xl font-bold uppercase tracking-widest sm:text-3xl"
          style={{ fontFamily: "serif" }}
        >
          {heading}
        </h1>

        <p className="theme-body text-sm leading-7 sm:text-base">{body}</p>

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all hover:bg-white"
        >
          {/* WhatsApp icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Back to WhatsApp
        </a>

        <p className="text-xs text-gray-500">
          Opens WhatsApp with a pre-filled message to our bot.
        </p>
      </section>
    </main>
  );
}
