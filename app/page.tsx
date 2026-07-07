import Image from "next/image";
import Link from "next/link";
import AnimatedCounter from "./components/AnimatedCounter";

export default function Home() {
  return (
    <main className="relative grid min-h-dvh grid-rows-[1fr_auto] overflow-hidden bg-theme-texture bg-cover bg-center bg-no-repeat">
      {/* Mode-aware overlay */}
      <div className="absolute inset-0 overlay-theme" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,560px)] w-[min(70vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-astral-gold/5 blur-[120px]" />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex min-h-0 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex w-full max-w-4xl flex-col items-center text-center">
          <Image
            src="/brand/logo.png?v=transparent-1"
            alt="Astral Legacy"
            width={180}
            height={180}
            className="logo-filter mb-6 h-auto w-28 sm:w-36 lg:w-44"
            priority
            unoptimized
          />

          <h1
            className="theme-heading mb-4 text-4xl font-bold uppercase tracking-widest sm:text-5xl lg:text-7xl"
            style={{ fontFamily: "serif" }}
          >
            Astral <span className="text-astral-gold">Legacy</span>
          </h1>

          <p className="theme-body mb-8 max-w-2xl text-base leading-7 sm:mb-10 md:text-xl">
            Experience the ultimate Web Companion for the Next-Gen WhatsApp AI.
            Collect cards, trade in live auctions, and summon your destiny.
          </p>

          <div className="grid w-full max-w-xl gap-4 sm:grid-cols-2">
            <Link
              href="/register"
              className="flex h-12 items-center justify-center rounded-sm border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all hover:bg-white"
            >
              Getting Started
            </Link>

            <a
              href="https://whatsapp.com/channel/0029VbCUyYDJUM2hhDyMld2w"
              target="_blank"
              rel="noopener noreferrer"
              className="join-btn flex h-12 items-center justify-center rounded-sm border px-6 text-base font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
            >
              Join WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <section className="footer-bar relative z-10 border-t px-4 py-5 backdrop-blur-sm sm:py-7">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-3 text-center">
          <div>
            <h3 className="theme-stat-heading text-2xl font-bold sm:text-3xl">
              <AnimatedCounter target={10} suffix="K+" duration={1200} />
            </h3>
            <p className="mt-1 text-xs uppercase tracking-widest text-astral-gold sm:text-sm">
              Users
            </p>
          </div>
          <div>
            <h3 className="theme-stat-heading text-2xl font-bold sm:text-3xl">
              <AnimatedCounter target={2} suffix="K+" duration={900} />
            </h3>
            <p className="mt-1 text-xs uppercase tracking-widest text-astral-gold sm:text-sm">
              Guilds
            </p>
          </div>
          <div>
            <h3 className="theme-stat-heading text-2xl font-bold sm:text-3xl">
              <AnimatedCounter target={10} suffix="M+" duration={1400} />
            </h3>
            <p className="mt-1 text-xs uppercase tracking-widest text-astral-gold sm:text-sm">
              Cards Claimed
            </p>
          </div>
        </div>
      </section>

      {/* ── Team / Org footer ─────────────────────────────────────────── */}
      <footer className="team-footer relative z-10 border-t px-4 py-4 sm:py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Org */}
          <a
            href="https://github.com/xen-labs"
            target="_blank"
            rel="noopener noreferrer"
            className="team-org-link flex items-center gap-2 text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70"
          >
            {/* GitHub mark (inline SVG — no extra dependency) */}
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Xen Labs
          </a>

          {/* Divider — visible only on sm+ */}
          <span className="team-divider hidden h-3 w-px sm:block" />

          {/* Team members */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Aoi-03"
              target="_blank"
              rel="noopener noreferrer"
              className="team-member-link group flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
            >
              <span className="team-role">UI &amp; Frontend</span>
              <span className="team-handle">@Aoi-03</span>
            </a>

            <span className="team-dot">·</span>

            <a
              href="https://github.com/Xenkaii"
              target="_blank"
              rel="noopener noreferrer"
              className="team-member-link group flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
            >
              <span className="team-role">Backend &amp; Lead</span>
              <span className="team-handle">@Xenkaii</span>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
