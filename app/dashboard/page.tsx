"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDashboard, authLogout, ApiResponseError } from "../../lib/api";
import type { DashboardResponse } from "../../lib/api";

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getDashboard()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiResponseError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Couldn't load your dashboard. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authLogout();
    } catch {
      // Even if the request fails, cookies may already be invalid —
      // send them to login regardless.
    }
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8">
        <div className="absolute inset-0 overlay-theme-heavy" />
        <div className="relative z-10">
          <svg
            className="h-8 w-8 animate-spin text-astral-gold"
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
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8">
        <div className="absolute inset-0 overlay-theme-heavy" />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 text-center">
          <p className="theme-body text-sm leading-7">
            {error || "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex h-12 items-center justify-center border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  const stats: { label: string; value: string }[] = [
    { label: "Ryo", value: formatNumber(data.ryo) },
    { label: "Kitsu", value: formatNumber(data.kitsu) },
    { label: "Bank", value: formatNumber(data.bank) },
    { label: "Home Vault Ryo", value: formatNumber(data.homeVaultRyo) },
    { label: "Home Vault Kitsu", value: formatNumber(data.homeVaultKitsu) },
    { label: "Pocket Tier", value: String(data.pocketTier) },
    { label: "Bank Vault Tier", value: String(data.bankVaultTier) },
    { label: "Daily Streak", value: `${data.dailyStreak} days` },
  ];

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 overlay-theme-heavy" />

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/logo.png?v=transparent-1"
              alt="Ayakashi"
              width={40}
              height={40}
              className="logo-filter h-auto w-10"
              unoptimized
            />
            <span className="theme-heading text-lg font-bold uppercase tracking-widest">
              Ayakashi
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="join-btn h-10 border px-4 text-sm font-semibold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </header>

        <div className="grid gap-2">
          <h1
            className="theme-heading text-2xl font-bold uppercase tracking-widest sm:text-3xl"
            style={{ fontFamily: "serif" }}
          >
            Welcome back, {data.displayName}
          </h1>
          <p className="theme-body text-sm">
            <span className="font-semibold text-astral-gold">
              @{data.username}
            </span>{" "}
            · Member since {formatMemberSince(data.memberSince)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="form-card flex flex-col gap-1 border p-4 shadow-[0_0_20px_rgba(0,0,0,0.25)] backdrop-blur-md"
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-astral-gold">
                {stat.label}
              </span>
              <span className="theme-stat-heading text-xl font-bold">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
