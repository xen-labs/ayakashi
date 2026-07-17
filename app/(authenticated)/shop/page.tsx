"use client";

import { useEffect, useState, useCallback } from "react";
import { getDashboard, ApiResponseError } from "../../../lib/api";
import type { DashboardResponse } from "../../../lib/api";
import { useRouter } from "next/navigation";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getDashboard();
      setData(res);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError("Couldn't load your dashboard. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
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
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="theme-body text-sm leading-7">
          {error || "Something went wrong."}
        </p>
        <button
          type="button"
          onClick={load}
          className="flex h-12 items-center justify-center border border-astral-gold bg-astral-gold px-6 text-base font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all hover:bg-white"
        >
          Retry
        </button>
      </div>
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
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
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
  );
}
