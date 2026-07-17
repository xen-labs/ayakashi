"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import AnimatedCounter from "./components/AnimatedCounter";
import { TopBar } from "./components/TopBar";
import { BottomNav } from "./components/BottomNav";
import { getMe } from "./lib/api";
import type { MeResponse } from "./lib/api";

function GithubCredits() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 border-t border-white/5 px-4 py-8 text-center opacity-50 transition-opacity hover:opacity-90">
      <a
        href="https://github.com/xen-labs"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest transition-opacity hover:opacity-70"
      >
        <svg
          aria-hidden="true"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
        Xen Labs
      </a>
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/Aoi-03"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
        >
          <span>UI &amp; Frontend</span>
          <span className="text-gray-500">@Aoi-03</span>
        </a>
        <span className="text-gray-600">·</span>
        <a
          href="https://github.com/Xenkaii"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
        >
          <span>Backend &amp; Lead</span>
          <span className="text-gray-500">@Xenkaii</span>
        </a>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: (
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    ),
    title: "Card Collection",
    body: "Claim, collect, and showcase hundreds of unique cards earned through the bot.",
    href: null,
  },
  {
    icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    title: "Live Auctions",
    body: "Bid on rare cards in real-time auctions with players across the world.",
    href: null,
    comingSoon: true,
  },
  {
    icon: (
      <>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </>
    ),
    title: "Marketplace",
    body: "Trade cards and currency with other players in the open marketplace.",
    href: null,
    comingSoon: true,
  },
  {
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    title: "Guilds",
    body: "Form or join guilds, compete in events, and climb the leaderboard together.",
    href: null,
    comingSoon: true,
  },
  {
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </>
    ),
    title: "Player Profiles",
    body: "Customise your profile, show off your rarest cards, and track your stats.",
    href: "/profile",
  },
  {
    icon: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
    title: "Mini-games",
    body: "Play browser-based mini-games for bonus rewards, linked to your WhatsApp progress.",
    href: null,
    comingSoon: true,
  },
];

function FeatureGrid({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="relative z-10 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        {!loggedIn && (
          <>
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-astral-gold opacity-60">
              Coming Soon
            </p>
            <h2
              className="theme-heading mb-16 text-center text-2xl font-bold uppercase tracking-widest sm:text-3xl"
              style={{ fontFamily: "serif" }}
            >
              The World Awaits
            </h2>
          </>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat) => {
            const clickable = loggedIn && Boolean(feat.href);

            const inner = (
              <>
                {loggedIn && feat.comingSoon && (
                  <span className="absolute right-3 top-3 rounded-sm border border-astral-gold/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-astral-gold opacity-70">
                    Soon
                  </span>
                )}
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-sm border border-astral-gold/20 bg-astral-gold/10">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-astral-gold"
                    aria-hidden="true"
                  >
                    {feat.icon}
                  </svg>
                </div>
                <h3
                  className="theme-heading mb-2 text-sm font-bold uppercase tracking-wider"
                  style={{ fontFamily: "serif" }}
                >
                  {feat.title}
                </h3>
                <p className="theme-body text-xs leading-6 opacity-70">
                  {feat.body}
                </p>
              </>
            );

            if (clickable) {
              return (
                <Link
                  key={feat.title}
                  href={feat.href as string}
                  className="form-card relative rounded-sm border p-6 backdrop-blur-md transition-transform hover:-translate-y-0.5"
                >
                  {inner}
                </Link>
              );
            }

            return (
              <div
                key={feat.title}
                className="form-card relative rounded-sm border p-6 backdrop-blur-md"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [statsOpacity, setStatsOpacity] = useState(1);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const loggedIn = Boolean(user);

  useEffect(() => {
    getMe()
      .then((res) => setUser(res))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  // Fade stats out as the user scrolls past the first screen (logged-out only)
  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const viewH = window.innerHeight;
      const fadeOver = viewH * 0.4;
      setStatsOpacity(Math.max(0, 1 - scrollY / fadeOver));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const BOT_URL = `https://wa.me/${process.env.NEXT_PUBLIC_BOT_NUMBER ?? "919999999999"}?text=register`;

  // Avoid flashing the logged-out hero for a split second before the
  // auth check resolves.
  if (!authChecked) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center bg-theme-texture bg-cover bg-center">
        <div className="pointer-events-none fixed inset-0 overlay-theme" />
        <svg
          className="relative z-10 h-8 w-8 animate-spin text-astral-gold"
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
      </main>
    );
  }

  // ── Logged-in: nav + straight to feature grid, hero skipped ──────────────
  if (loggedIn && user) {
    return (
      <>
        <TopBar user={user} />
        <main className="relative bg-theme-texture bg-cover bg-center bg-no-repeat pb-24">
          <div className="pointer-events-none fixed inset-0 overlay-theme" />

          <section className="relative z-10 px-4 pt-8 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-4xl">
              <h1
                className="theme-heading text-xl font-bold uppercase tracking-widest sm:text-2xl"
                style={{ fontFamily: "serif" }}
              >
                Welcome back, {user.displayName}
              </h1>
              <p className="theme-body mt-1 text-sm opacity-70">
                Here&apos;s what&apos;s happening across Ayakashi.
              </p>
            </div>
          </section>

          <FeatureGrid loggedIn />

          <GithubCredits />
        </main>
        <BottomNav />
      </>
    );
  }

  // ── Logged-out: full marketing hero + coming-soon grid ────────────────────
  return (
    <main className="relative bg-theme-texture bg-cover bg-center bg-no-repeat">
      <div className="pointer-events-none fixed inset-0 overlay-theme" />
      <div className="pointer-events-none fixed left-1/2 top-1/2 h-[min(70vw,560px)] w-[min(70vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-astral-gold/5 blur-[120px]" />

      <section className="relative z-10 flex min-h-dvh flex-col items-center justify-between px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-1 w-full items-center justify-center">
          <div className="flex w-full max-w-4xl flex-col items-center text-center">
            <Image
              src="/brand/logo.png?v=transparent-1"
              alt="Ayakashi"
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
              Ayakashi
            </h1>

            <p className="theme-body mb-8 max-w-2xl text-base leading-7 sm:mb-10 md:text-xl">
              Experience the ultimate Web Companion for the Next-Gen WhatsApp
              AI. Collect cards, trade in live auctions, and summon your
              destiny.
            </p>

            <div className="grid w-full max-w-xl gap-4 sm:grid-cols-2">
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center justify-center rounded-sm border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all hover:bg-white"
              >
                Get Started
              </a>
              <a
                href="https://whatsapp.com/channel/0029VbCUyYDJUM2hhDyMld2w"
                target="_blank"
                rel="noopener noreferrer"
                className="join-btn flex h-12 items-center justify-center rounded-sm border px-6 text-base font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
              >
                Join WhatsApp
              </a>
            </div>

            <p className="mt-5 text-sm text-gray-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-astral-gold transition-colors hover:text-white"
              >
                Log in →
              </Link>
            </p>
          </div>
        </div>

        {/* Stats bar — sits at bottom of first viewport, fades on scroll */}
        <div
          className="w-full border-t footer-bar rounded-sm px-4 py-4 backdrop-blur-sm"
          style={{ opacity: statsOpacity, transition: "opacity 0.05s linear" }}
          aria-hidden={statsOpacity === 0}
        >
          <div className="mx-auto grid max-w-6xl grid-cols-3 gap-3 text-center">
            <div>
              <h3 className="theme-stat-heading text-2xl font-bold sm:text-3xl">
                <AnimatedCounter target={10} suffix="K+" duration={1200} />
              </h3>
              <p className="mt-0.5 text-xs uppercase tracking-widest text-astral-gold">
                Users
              </p>
            </div>
            <div>
              <h3 className="theme-stat-heading text-2xl font-bold sm:text-3xl">
                <AnimatedCounter target={2} suffix="K+" duration={900} />
              </h3>
              <p className="mt-0.5 text-xs uppercase tracking-widest text-astral-gold">
                Guilds
              </p>
            </div>
            <div>
              <h3 className="theme-stat-heading text-2xl font-bold sm:text-3xl">
                <AnimatedCounter target={10} suffix="M+" duration={1400} />
              </h3>
              <p className="mt-0.5 text-xs uppercase tracking-widest text-astral-gold">
                Cards Claimed
              </p>
            </div>
          </div>
        </div>
      </section>

      <FeatureGrid loggedIn={false} />

      <GithubCredits />
    </main>
  );
}
