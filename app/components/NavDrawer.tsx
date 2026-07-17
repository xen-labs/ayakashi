"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X, Settings, LogOut, HelpCircle, MessageCircle } from "lucide-react";
import { authLogout } from "../../lib/api";
import type { MeResponse } from "../../lib/api";

const SECONDARY_LINKS = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help & Support", icon: HelpCircle },
];

export function NavDrawer({
  user,
  open,
  onClose,
}: {
  user: MeResponse | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authLogout();
    } catch {
      /* cookies may already be invalid — proceed to login regardless */
    }
    router.push("/login");
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity ${
        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={`absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-l border-astral-gold/20 bg-[#0d0d1a] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="theme-heading text-sm font-bold uppercase tracking-widest text-astral-gold">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-gray-400 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {user && (
          <div className="border-b border-white/10 px-5 py-4">
            <p className="theme-body text-sm font-semibold text-white">
              {user.displayName}
            </p>
            <p className="text-xs text-gray-500">@{user.username}</p>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-1 px-2 py-3">
          {SECONDARY_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-astral-gold"
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}

          <a
            href="https://whatsapp.com/channel/0029VbCUyYDJUM2hhDyMld2w"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-astral-gold"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Channel
          </a>
        </div>

        <div className="border-t border-white/10 px-2 py-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}
