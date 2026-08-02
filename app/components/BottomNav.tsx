"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  ShoppingBag,
  Backpack,
  Hammer,
  Trophy,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";

// Primary nav — 6 items (Home + 5 pages)
const PRIMARY_NAV = [
  { href: "/",            label: "Home",      Icon: Home            },
  { href: "/dashboard",   label: "Dashboard", Icon: LayoutDashboard },
  { href: "/shop",        label: "Shop",      Icon: ShoppingBag     },
  { href: "/inventory",   label: "Items",     Icon: Backpack        },
  { href: "/craft",       label: "Craft",     Icon: Hammer          },
  { href: "/leaderboard", label: "Ranks",     Icon: Trophy          },
];

// Secondary nav — shown in overflow drawer
const SECONDARY_NAV = [
  { href: "/upgrade",    label: "Upgrade"    },
  { href: "/bank-vault", label: "Bank/Vault" },
  { href: "/trade",      label: "Trade"      },
  { href: "/loadout",    label: "Loadout"    },
  { href: "/decks",      label: "Decks"      },
  { href: "/players",    label: "Players"    },
  { href: "/cosmetics",  label: "Cosmetics"  },
  { href: "/profile",    label: "Profile"    },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isSecondaryActive = SECONDARY_NAV.some(
    (n) => pathname === n.href || pathname?.startsWith(n.href + "/"),
  );

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(200,168,75,0.18)] bg-black/98 backdrop-blur-md"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {PRIMARY_NAV.map(({ href, label, Icon }) => {
            // "/" must be exact-match only — every path starts with "/"
            const active = href === "/"
              ? pathname === "/"
              : pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                  active
                    ? "text-[#c8a84b]"
                    : "text-[rgba(200,168,75,0.38)] hover:text-[rgba(200,168,75,0.75)]"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.7)]" />
                )}
                <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.2 : 1.6} />
                <span className={`text-[9px] font-bold uppercase tracking-[0.08em] ${active ? "text-[#c8a84b]" : ""}`}>
                  {label}
                </span>
              </Link>
            );
          })}

          {/* ── More button ── */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
              isSecondaryActive || moreOpen
                ? "text-[#c8a84b]"
                : "text-[rgba(200,168,75,0.38)] hover:text-[rgba(200,168,75,0.75)]"
            }`}
            aria-expanded={moreOpen}
            aria-label="More pages"
          >
            {(isSecondaryActive || moreOpen) && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.7)]" />
            )}
            <MoreHorizontal className="h-[20px] w-[20px]" strokeWidth={moreOpen ? 2.2 : 1.6} />
            <span className="text-[9px] font-bold uppercase tracking-[0.08em]">More</span>
          </button>
        </div>
      </nav>

      {/* ── More drawer (slides up above nav) ── */}
      {moreOpen && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-[rgba(200,168,75,0.20)] bg-[#0d0c00]/98 backdrop-blur-md">
            <div className="mx-auto grid max-w-lg grid-cols-4 gap-0">
              {SECONDARY_NAV.map(({ href, label }) => {
                const active = pathname === href || pathname?.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center justify-center gap-1 border-b border-r border-[rgba(200,168,75,0.10)] px-2 py-4 text-center transition-colors last:border-r-0 ${
                      active
                        ? "bg-[rgba(200,168,75,0.08)] text-[#c8a84b]"
                        : "text-[rgba(200,168,75,0.50)] hover:bg-[rgba(200,168,75,0.05)] hover:text-[rgba(200,168,75,0.80)]"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
