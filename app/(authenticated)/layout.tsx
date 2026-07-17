"use client";

import { useAuth } from "../../lib/useAuth";
import { TopBar } from "../../components/TopBar";
import { BottomNav } from "../../components/BottomNav";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth(true);

  if (loading) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-theme-texture bg-cover bg-center px-4 py-8">
        <div className="absolute inset-0 overlay-theme-heavy" />
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

  // useAuth(true) already redirects to /login on a 401 — render nothing
  // in that brief window rather than flashing protected content.
  if (!user) return null;

  return (
    <div className="min-h-dvh bg-theme-texture bg-cover bg-center">
      <div className="fixed inset-0 -z-10 overlay-theme-heavy" />
      <TopBar user={user} />
      <div className="pb-20">{children}</div>
      <BottomNav />
    </div>
  );
}
