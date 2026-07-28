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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(200,168,75,0.15)] bg-black/95 backdrop-blur-sm lg:hidden"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                active
                  ? "text-[#c8a84b]"
                  : "text-[rgba(200,168,75,0.35)] hover:text-[rgba(200,168,75,0.70)]"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "drop-shadow-[0_0_6px_rgba(200,168,75,0.7)]" : ""}`}
                strokeWidth={active ? 2.2 : 1.6}
              />
              <span>{label}</span>
              {active && (
                <span className="absolute bottom-0 h-0.5 w-10 bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.6)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
