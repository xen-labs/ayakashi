"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  CircleUserRound,
  LogOut,
  Settings,
  HelpCircle,
  ArrowUpCircle,
  Trophy,
} from "lucide-react";
import { useCurrency } from "./CurrencyContext";
import { AvatarWithFrame } from "./AvatarWithFrame";
import { NotificationBell } from "./NotificationBell";
import { authLogout } from "../../lib/api";
import type { MeResponse } from "../../lib/api";

const HIDDEN_ON = ["/profile", "/login", "/register"];

// Mirrors BottomNav's primary/secondary split — Shop/Market are core
// spend-or-trade loops, Inventory and Cards are core browsing. Upgrade
// moved out (same "manage what you've built" bucket as Craft/Bank-Vault
// on mobile) — reachable from the Profile dropdown or its own page link,
// not a top-level rail item.
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shop", label: "Shop" },
  { href: "/marketplace", label: "Market" },
  { href: "/cards", label: "Cards" },
  { href: "/inventory", label: "Inventory" },
];

function formatCoin(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function TopBar({ user }: { user: MeResponse | null }) {
  const { ryo, kitsu } = useCurrency();
  const router = useRouter();
  const pathname = usePathname();

  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hidden = HIDDEN_ON.some(
    (p) => pathname === p || pathname?.startsWith(p + "/"),
  );

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [profileOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authLogout();
    } catch {
      /* proceed anyway */
    }
    router.push("/login");
  };

  if (hidden) return null;

  const isAuthenticated = Boolean(user);

  return (
    <header className="topbar sticky top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6">
      {/* ── Left: Logo + Brand + Nav ── */}
      <div className="flex items-center gap-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/logo.png?v=transparent-1"
            alt="Ayakashi"
            width={26}
            height={26}
            className="logo-filter h-auto w-[26px]"
            unoptimized
          />
          <span className="font-display font-bold uppercase tracking-[0.2em] text-[#c8a84b] text-sm">
            Ayakashi
          </span>
        </Link>

        {/* gold rule separator */}
        {isAuthenticated && (
          <span
            className="hidden h-4 w-px bg-[rgba(200,168,75,0.25)] sm:block"
            aria-hidden="true"
          />
        )}

        {isAuthenticated && (
          <nav className="hidden items-center gap-5 sm:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const active =
                pathname === href || pathname?.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`topbar-nav-link text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${
                    active ? "topbar-nav-link-active" : ""
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* ── Right: Coins + Profile ── */}
      <div className="flex items-center gap-3">
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            {/* Ryo */}
            <div className="flex items-center gap-1.5">
              <Image
                src="/currency/ryo.webp"
                alt="Ryo"
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
                unoptimized
              />
              <span className="topbar-coin-ryo text-xs font-bold tabular-nums">
                {formatCoin(ryo)}
              </span>
            </div>
            {/* Kitsu */}
            <div className="flex items-center gap-1.5">
              <Image
                src="/currency/kitsu.webp"
                alt="Kitsu"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                unoptimized
              />
              <span className="topbar-coin-amount text-xs font-bold tabular-nums">
                {formatCoin(kitsu)}
              </span>
            </div>
            <div className="topbar-divider h-5 w-px" aria-hidden="true" />
          </div>
        )}

        {isAuthenticated && <NotificationBell />}

        {isAuthenticated && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              className="topbar-icon-btn flex items-center justify-center transition-colors"
            >
              <AvatarWithFrame
                avatarSrc={
                  user?.avatarUrl ||
                  "/user-profile/user-profile/default-avatar.webp"
                }
                frameSrc="/user-profile/user-profile/default-avatar-frame.webp"
                innerSize={26}
              />
            </button>

            {profileOpen && (
              <div className="topbar-dropdown absolute right-0 top-full mt-2 w-52 border shadow-[0_8px_40px_rgba(0,0,0,0.8)]">
                {user && (
                  <div className="topbar-dropdown-header border-b px-4 py-3">
                    <p className="text-sm font-bold text-[#f0e6c8]">
                      {user.displayName}
                    </p>
                    <p className="topbar-dropdown-sub text-xs">
                      @{user.username}
                    </p>
                  </div>
                )}

                <div className="py-1">
                  <Link
                    href="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="topbar-dropdown-item flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  >
                    <CircleUserRound className="h-4 w-4 shrink-0" />
                    Profile
                  </Link>
                  <Link
                    href="/upgrade"
                    onClick={() => setProfileOpen(false)}
                    className="topbar-dropdown-item flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  >
                    <ArrowUpCircle className="h-4 w-4 shrink-0" />
                    Upgrade
                  </Link>
                  <Link
                    href="/leaderboard"
                    onClick={() => setProfileOpen(false)}
                    className="topbar-dropdown-item flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  >
                    <Trophy className="h-4 w-4 shrink-0" />
                    Leaderboard
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="topbar-dropdown-item flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    Settings
                  </Link>
                  <Link
                    href="/help"
                    onClick={() => setProfileOpen(false)}
                    className="topbar-dropdown-item flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  >
                    <HelpCircle className="h-4 w-4 shrink-0" />
                    Help &amp; Support
                  </Link>
                </div>

                <div className="border-t border-[rgba(200,168,75,0.12)] py-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    {loggingOut ? "Logging out…" : "Log out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
