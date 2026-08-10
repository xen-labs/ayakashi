"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/useAuth";

// Redirect /profile → /profile/:myUsername
export default function ProfileRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth(false);

  useEffect(() => {
    if (!loading && user?.username) {
      router.replace(`/profile/${user.username}`);
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <svg
        className="h-8 w-8 animate-spin text-ayakashi-gold"
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
  );
}
