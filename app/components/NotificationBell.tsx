"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  UserPlus,
  ArrowLeftRight,
  Tag,
  Gavel,
  Crown,
} from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../lib/api";
import type {
  AppNotification,
  MarketplaceSaleNotificationData,
  AuctionOutbidNotificationData,
  AuctionWonNotificationData,
  AuctionSoldNotificationData,
} from "../../lib/api";

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function NotificationIcon({ type }: { type: AppNotification["type"] }) {
  switch (type) {
    case "marketplace_sale":
      return <Tag className="h-3.5 w-3.5" />;
    case "friend_request":
      return <UserPlus className="h-3.5 w-3.5" />;
    case "trade_offer":
      return <ArrowLeftRight className="h-3.5 w-3.5" />;
    case "auction_won":
      return <Crown className="h-3.5 w-3.5" />;
    case "auction_outbid":
    case "auction_sold":
      return <Gavel className="h-3.5 w-3.5" />;
  }
}

function notificationHref(n: AppNotification): string {
  switch (n.type) {
    case "marketplace_sale":
      return "/dashboard";
    case "auction_outbid":
    case "auction_won":
    case "auction_sold": {
      // Every auction data shape carries cardInstanceId — route straight
      // to that auction's page rather than a generic dashboard bounce,
      // since "go see the thing that changed" is the whole point of
      // clicking an outbid/won/sold notification.
      const d = n.data as { cardInstanceId?: string };
      return d.cardInstanceId ? `/auctions/${d.cardInstanceId}` : "/auctions";
    }
    case "friend_request":
    case "trade_offer":
      return "/dashboard";
  }
}

function NotificationText({ n }: { n: AppNotification }) {
  if (n.type === "marketplace_sale") {
    const d = n.data as unknown as MarketplaceSaleNotificationData;
    return (
      <span className="text-[#f0e6c8]">
        <span className="font-semibold text-[#e6c96a]">{d.buyerName}</span>{" "}
        bought{" "}
        <span className="font-semibold text-[#e6c96a]">{d.cardName}</span> for{" "}
        {d.price?.toLocaleString?.() ?? d.price} Kitsu
      </span>
    );
  }
  if (n.type === "auction_outbid") {
    const d = n.data as unknown as AuctionOutbidNotificationData;
    return (
      <span className="text-[#f0e6c8]">
        <span className="font-semibold text-[#e6c96a]">{d.newBidderName}</span>{" "}
        outbid you — new high bid{" "}
        {d.newHighBid?.toLocaleString?.() ?? d.newHighBid} Kitsu
      </span>
    );
  }
  if (n.type === "auction_won") {
    const d = n.data as unknown as AuctionWonNotificationData;
    return (
      <span className="text-[#f0e6c8]">
        You won{" "}
        <span className="font-semibold text-[#e6c96a]">{d.cardName}</span> for{" "}
        {d.finalPrice?.toLocaleString?.() ?? d.finalPrice} Kitsu
      </span>
    );
  }
  if (n.type === "auction_sold") {
    const d = n.data as unknown as AuctionSoldNotificationData;
    if (d.failed) {
      return (
        <span className="text-[#f0e6c8]">
          Your auction for{" "}
          <span className="font-semibold text-[#e6c96a]">{d.cardName}</span> hit
          an error settling — please check it
        </span>
      );
    }
    return (
      <span className="text-[#f0e6c8]">
        <span className="font-semibold text-[#e6c96a]">{d.buyerName}</span> won
        your auction for{" "}
        <span className="font-semibold text-[#e6c96a]">{d.cardName}</span> —{" "}
        {d.finalPrice?.toLocaleString?.() ?? d.finalPrice} Kitsu
      </span>
    );
  }
  if (n.type === "friend_request") {
    return (
      <span className="text-[#f0e6c8]">You have a new friend request</span>
    );
  }
  return <span className="text-[#f0e6c8]">You have a new trade offer</span>;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll unread count in the background regardless of whether the
  // dropdown is open, so the badge stays current — but only fetch the
  // full feed (with its per-item payloads) once the user actually
  // opens it, since that's the more expensive call.
  const pollUnread = useCallback(async () => {
    try {
      const res = await getNotifications(1);
      setUnreadCount(res.unreadCount);
      if (!loaded) setItems(res.items);
    } catch {
      /* noop — badge just won't update this cycle */
    }
  }, [loaded]);

  useEffect(() => {
    pollUnread();
    const t = setInterval(pollUnread, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications(1);
      setItems(res.items);
      setUnreadCount(res.unreadCount);
      setLoaded(true);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !loaded) loadFeed();
  }, [open, loaded, loadFeed]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleMarkAllRead = async () => {
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      /* the optimistic update stands either way — a failed mark-read
         isn't worth surfacing an error toast for */
    }
  };

  const handleItemClick = (n: AppNotification) => {
    if (n.read) return;
    setUnreadCount((c) => Math.max(0, c - 1));
    setItems((prev) =>
      prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
    );
    markNotificationRead(n.id).catch(() => {
      /* optimistic update stands */
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="topbar-icon-btn relative flex items-center justify-center transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ayakashi-gold px-1 text-[9px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="topbar-dropdown fixed left-2 right-2 top-[60px] z-40 border shadow-[0_8px_40px_rgba(0,0,0,0.8)] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="topbar-dropdown-header flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-bold text-[#f0e6c8]">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold uppercase tracking-widest text-ayakashi-gold transition-colors hover:text-[#e6c96a]"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto py-1">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-8">
                <svg
                  className="h-5 w-5 animate-spin text-ayakashi-gold"
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
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-[rgba(200,168,75,0.40)]">
                Nothing yet.
              </p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={notificationHref(n)}
                  onClick={() => handleItemClick(n)}
                  className={`topbar-dropdown-item flex items-start gap-2.5 px-4 py-2.5 text-xs transition-colors ${!n.read ? "bg-[rgba(200,168,75,0.06)]" : ""}`}
                >
                  <span className="mt-0.5 shrink-0 text-ayakashi-gold">
                    <NotificationIcon type={n.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <NotificationText n={n} />
                    <span className="mt-0.5 block text-[10px] uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
                      {fmtRelative(n.createdAt)}
                    </span>
                  </span>
                  {!n.read && (
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ayakashi-gold" />
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
