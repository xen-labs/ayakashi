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

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="theme-body text-sm leading-7">{error || "Something went wrong."}</p>
        <button
          type="button"
          onClick={load}
          className="h-11 border border-[#c8a84b] px-8 text-sm font-bold uppercase tracking-widest text-[#c8a84b] transition-all hover:bg-[#c8a84b] hover:text-black"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats: { label: string; value: string }[] = [
    { label: "Ryo",              value: formatNumber(data.ryo) },
    { label: "Kitsu",            value: formatNumber(data.kitsu) },
    { label: "Bank",             value: formatNumber(data.bank) },
    { label: "Vault Ryo",        value: formatNumber(data.homeVaultRyo) },
    { label: "Vault Kitsu",      value: formatNumber(data.homeVaultKitsu) },
    { label: "Pocket Tier",      value: String(data.pocketTier) },
    { label: "Bank Tier",        value: String(data.bankVaultTier) },
    { label: "Daily Streak",     value: `${data.dailyStreak}` },
  ];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">

      {/* ── Welcome text ── */}
      <div className="flex flex-col gap-1.5">
        <h1
          className="font-display text-2xl font-black uppercase tracking-[0.05em] text-[#f0e6c8] sm:text-3xl"
        >
          Welcome back, <span className="text-[#c8a84b]">{data.displayName}</span>
        </h1>
        <p className="text-sm text-[#6b5e3a]">
          @{data.username} · Member since {formatMemberSince(data.memberSince)}
        </p>
      </div>

      <hr className="gold-rule" />

      {/* ── Brush-stroke section header ── */}
      <div className="section-header">
        <span className="section-header-text">Statistics</span>
      </div>

      {/* ── Coin medallion stat grid ── */}
      <div className="flex flex-wrap justify-center gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-3">
            <div className="coin-medallion">
              <span className="coin-medallion-value">{stat.value}</span>
            </div>
            <span className="coin-medallion-label">{stat.label}</span>
          </div>
        ))}
      </div>

    </section>
  );
}
