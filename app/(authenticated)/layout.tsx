"use client";

import { useAuth } from "../../lib/useAuth";
import { TopBar } from "../components/TopBar";
import { CurrencyProvider } from "../components/CurrencyContext";
import { GithubCredits } from "../components/GithubCredits";
import { BottomNav } from "../components/BottomNav";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth(true);

  if (loading) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-8">
        <svg
          className="relative z-10 h-8 w-8 animate-spin text-astral-gold"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </main>
    );
  }

  if (!user) return null;

  return (
    <CurrencyProvider>
      <div className="min-h-dvh bg-[#0a0a0a]">
        <TopBar user={user} />
        {/* pb-16 reserves space so content clears the fixed bottom nav */}
        <div className="flex min-h-[calc(100dvh-56px)] flex-col pb-16">
          <main className="flex-1">{children}</main>
          <GithubCredits />
        </div>
        <BottomNav />
      </div>
    </CurrencyProvider>
  );
}
