"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Backpack,
  CircleUserRound,
} from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shop", label: "Shop", icon: Store },
  { href: "/inventory", label: "Inventory", icon: Backpack },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-black/90 backdrop-blur-md">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname?.startsWith(tab.href + "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors"
          >
            <Icon
              className={`h-5 w-5 ${
                active ? "text-astral-gold" : "text-gray-500"
              }`}
              strokeWidth={active ? 2.4 : 1.8}
            />
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                active ? "text-astral-gold" : "text-gray-500"
              }`}
            >
              {tab.label}
            </span>
            {active && (
              <span className="absolute bottom-0 h-0.5 w-10 rounded-t-full bg-astral-gold shadow-[0_0_8px_rgba(212,175,55,0.7)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
