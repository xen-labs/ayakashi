"use client";

import { useEffect, useState, useCallback } from "react";
import { getDashboard, ApiResponseError } from "../../../lib/api";
import type { DashboardResponse } from "../../../lib/api";
import { useRouter } from "next/navigation";

function formatNumber(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await getDashboard(); console.log("[dashboard] API response:", res); setData(res); }
    catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) { router.push("/login"); return; }
      setError("Couldn't load your dashboard. Try refreshing.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <svg className="h-8 w-8 animate-spin text-astral-gold" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );

  if (error || !data) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="theme-body text-sm">{error || "Something went wrong."}</p>
      <button type="button" onClick={load}
        className="brush-btn w-40">
        Retry
      </button>
    </div>
  );

  const stats: { label: string; value: string }[] = [
    { label: "Ryo",          value: formatNumber(data.ryo) },
    { label: "Kitsu",        value: formatNumber(data.kitsu) },
    { label: "Bank",         value: formatNumber(data.bank) },
    { label: "Vault Ryo",    value: formatNumber(data.homeVaultRyo) },
    { label: "Vault Kitsu",  value: formatNumber(data.homeVaultKitsu) },
    { label: "Pocket Tier",  value: String(data.pocketTier) },
    { label: "Bank Tier",    value: String(data.bankVaultTier) },
    { label: "Streak",       value: `${data.dailyStreak}d` },
  ];

  return (
    <section className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 rounded-full bg-[rgba(200,168,75,0.04)] blur-[80px]" />

      {/* ── Welcome ── */}
      <div className="relative flex flex-col gap-1">
        <h1 className="font-display text-2xl font-black uppercase tracking-[0.05em] text-[#f0e6c8] sm:text-3xl">
          Welcome back,{" "}
          <span className="text-[#c8a84b]">{data.displayName}</span>
        </h1>
        <p className="font-ui text-xs uppercase tracking-[0.14em] text-[rgba(200,168,75,0.40)]">
          @{data.username} &nbsp;·&nbsp; Member since {formatMemberSince(data.memberSince)}
        </p>
        <div className="mt-2 h-px w-32 bg-gradient-to-r from-[#c8a84b] to-transparent" />
      </div>

      <hr className="gold-rule" />

      {/* ── Section header ── */}
      <div className="section-header">
        <span className="section-header-text">Statistics</span>
      </div>

      {/* ── Coin medallion grid ── */}
      <div className="flex flex-wrap justify-center gap-x-10 gap-y-8">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-2">
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
