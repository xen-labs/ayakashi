"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getMe, ApiResponseError } from "./api";
import type { MeResponse } from "./api";

interface AuthState {
  user: MeResponse | null;
  loading: boolean;
}

export function useAuth(redirectOnFail: boolean): AuthState {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  const load = useCallback(async () => {
    try {
      const user = await getMe();
      setState({ user, loading: false });
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        setState({ user: null, loading: false });
        if (redirectOnFail) router.push("/login");
        return;
      }
      setState({ user: null, loading: false });
    }
  }, [redirectOnFail, router]);

  useEffect(() => {
    load();
  }, [load]);

  return state;
}
