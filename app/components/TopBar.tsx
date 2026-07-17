"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { NavDrawer } from "./NavDrawer";
import type { MeResponse } from "../../lib/api";

export function TopBar({ user }: { user: MeResponse | null }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/logo.png?v=transparent-1"
            alt="Ayakashi"
            width={30}
            height={30}
            className="logo-filter h-auto w-[30px]"
            unoptimized
          />
          <span className="theme-heading text-sm font-bold uppercase tracking-widest">
            Ayakashi
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/15 text-gray-300 transition-colors hover:border-astral-gold hover:text-astral-gold"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <NavDrawer
        user={user}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
