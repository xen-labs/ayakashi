"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Backpack, CircleUserRound } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/shop",      label: "Shop",      Icon: ShoppingBag     },
  { href: "/inventory", label: "Inventory", Icon: Backpack         },
  { href: "/profile",   label: "Profile",   Icon: CircleUserRound  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(200,168,75,0.18)] bg-black/98 backdrop-blur-md"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors ${
                active
                  ? "text-[#c8a84b]"
                  : "text-[rgba(200,168,75,0.38)] hover:text-[rgba(200,168,75,0.75)]"
              }`}
            >
              {/* active top indicator line */}
              {active && (
                <span className="absolute top-0 left-1/2 h-0.5 w-10 -translate-x-1/2 bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.7)]" />
              )}
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2.2 : 1.6}
              />
              <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${active ? "text-[#c8a84b]" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
