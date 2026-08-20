"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingBag,
    Store,
    Gavel,
    Layers,
    CircleUserRound,
    MoreHorizontal
} from "lucide-react";
import { useState } from "react";

// Primary nav — 6 items, no separate "Home" slot: for a logged-in user
// Dashboard IS home (the marketing "/" page isn't something an
// authenticated player navigates back to), so merging them frees a slot
// instead of showing two landing-page entries side by side.
//
// Shop / Market / Auctions / Profile are primary per design direction —
// Shop, Market, and Auctions are all "spend or trade right now" loops
// (Shop = NPC catalog, Market = flat-price player-to-player, Auctions =
// live/competitive player-to-player), Profile is identity/stats a player
// checks constantly, not an occasional settings-style page. Cards stays
// primary for the same reason noted before: core browsing content, same
// footing as Shop, not a once-in-a-while check like Ranks.
//
// [CHANGED] Items (inventory) moved OUT of primary to make room for
// Auctions — it's a "manage what you already own" page, the same bucket
// Craft/Upgrade/Bank-Vault already got sorted into below, not a "browse
// or act right now" loop the way Auctions is. Auctions specifically
// earns the primary slot over Items because it's time-sensitive (an
// auction you're winning can be lost while you're not looking at it) —
// exactly the kind of thing bottom-nav primary real estate is for.
//
// Craft/Upgrade/Bank-Vault moved OUT of primary (Craft was here before)
// — these are all "manage what you've already built" pages, a different
// mode of use than "browse or act right now." That's the same primary/
// secondary split Ranks already followed; Craft just hadn't been sorted
// into it yet. Fusion belongs in this same bucket — it consumes cards
// you already own to mint a new one, not something a player is browsing
// or acting on moment-to-moment the way Shop/Market/Auctions are.
const PRIMARY_NAV = [
    { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/shop", label: "Shop", Icon: ShoppingBag },
    { href: "/marketplace", label: "Market", Icon: Store },
    { href: "/auctions", label: "Auctions", Icon: Gavel },
    { href: "/cards", label: "Cards", Icon: Layers },
    { href: "/profile", label: "Profile", Icon: CircleUserRound }
];

// Secondary nav — shown in overflow drawer
const SECONDARY_NAV = [
    { href: "/inventory", label: "Items" },
    { href: "/craft", label: "Craft" },
    { href: "/upgrade", label: "Upgrade" },
    { href: "/fusion", label: "Fusion" },
    { href: "/bank-vault", label: "Bank/Vault" },
    { href: "/leaderboard", label: "Ranks" },
    { href: "/trade", label: "Trade" },
    { href: "/loadout", label: "Loadout" },
    { href: "/decks", label: "Decks" },
    { href: "/players", label: "Players" },
    { href: "/cosmetics", label: "Cosmetics" }
];

export function BottomNav() {
    const pathname = usePathname();
    const [moreOpen, setMoreOpen] = useState(false);

    const isSecondaryActive = SECONDARY_NAV.some(
        n => pathname === n.href || pathname?.startsWith(n.href + "/")
    );

    return (
        <>
            {/* [REDESIGNED] bg-black/98 was effectively opaque (98% black) —
          "backdrop-blur-md" on a near-opaque background does almost
          nothing visually, since there's barely any translucency for
          it to blur THROUGH. Dropped to /70 so the blur actually shows
          page content softly bleeding through behind the nav (real
          glassmorphism, not just a dark bar), and added a top-edge
          gradient glow line for a bit of polish on scroll-under
          content. */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(200,168,75,0.18)] bg-black/70 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl"
                aria-label="Main navigation"
            >
                <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[rgba(200,168,75,0.4)] to-transparent" />
                <div className="mx-auto flex max-w-lg items-stretch">
                    {PRIMARY_NAV.map(({ href, label, Icon }) => {
                        const active =
                            pathname === href ||
                            pathname?.startsWith(href + "/");
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-200 ${
                                    active
                                        ? "text-[#c8a84b]"
                                        : "text-[rgba(200,168,75,0.38)] hover:text-[rgba(200,168,75,0.75)]"
                                }`}
                            >
                                {active && (
                                    <>
                                        <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.7)]" />
                                        {/* Soft glow bloom behind the active icon — subtle,
                        not the whole tab, just a hint of light under
                        the icon itself. */}
                                        <span className="absolute top-1 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-[#c8a84b]/20 blur-md" />
                                    </>
                                )}
                                <Icon
                                    className="relative h-[20px] w-[20px]"
                                    strokeWidth={active ? 2.2 : 1.6}
                                />
                                <span
                                    className={`relative text-[9px] font-bold uppercase tracking-[0.08em] ${active ? "text-[#c8a84b]" : ""}`}
                                >
                                    {label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* ── More button ── */}
                    <button
                        type="button"
                        onClick={() => setMoreOpen(v => !v)}
                        className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-all duration-200 ${
                            isSecondaryActive || moreOpen
                                ? "text-[#c8a84b]"
                                : "text-[rgba(200,168,75,0.38)] hover:text-[rgba(200,168,75,0.75)]"
                        }`}
                        aria-expanded={moreOpen}
                        aria-label="More pages"
                    >
                        {(isSecondaryActive || moreOpen) && (
                            <>
                                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-[#c8a84b] shadow-[0_0_8px_rgba(200,168,75,0.7)]" />
                                <span className="absolute top-1 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-[#c8a84b]/20 blur-md" />
                            </>
                        )}
                        <MoreHorizontal
                            className={`relative h-[20px] w-[20px] transition-transform duration-300 ${moreOpen ? "rotate-90" : ""}`}
                            strokeWidth={moreOpen ? 2.2 : 1.6}
                        />
                        <span className="relative text-[9px] font-bold uppercase tracking-[0.08em]">
                            More
                        </span>
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
                    {/* [FIXED] Was bg-[#0d0c00]/75 with backdrop-blur-xl — over a
              busy backdrop (a grid of colorful card thumbnails, see
              MarketplacePage) 25% see-through was enough to make the
              labels genuinely hard to read, blur or no blur. A menu
              needs to be legible above almost everything else it does;
              solid background trades a bit of glass polish for actually
              being readable, which matters more here. */}
                    <div className="drawer-slide-up fixed bottom-16 left-0 right-0 z-40 border-t border-[rgba(200,168,75,0.20)] bg-[#0d0c00] shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
                        <div className="mx-auto grid max-w-lg grid-cols-3 gap-0">
                            {SECONDARY_NAV.map(({ href, label }) => {
                                const active =
                                    pathname === href ||
                                    pathname?.startsWith(href + "/");
                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        onClick={() => setMoreOpen(false)}
                                        className={`flex flex-col items-center justify-center gap-1 border-b border-r border-[rgba(200,168,75,0.10)] px-2 py-4 text-center transition-colors last:border-r-0 ${
                                            active
                                                ? "bg-[rgba(200,168,75,0.14)] text-[#c8a84b]"
                                                : "text-[rgba(200,168,75,0.65)] hover:bg-[rgba(200,168,75,0.08)] hover:text-[rgba(200,168,75,0.95)]"
                                        }`}
                                    >
                                        <span className="text-[10px] font-bold uppercase tracking-[0.1em]">
                                            {label}
                                        </span>
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
