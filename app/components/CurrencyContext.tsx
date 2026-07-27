"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getDashboard, ApiResponseError } from "../../lib/api";

interface CurrencyState {
  ryo: number | null;
  kitsu: number | null;
  /** Call this after any action that changes balances (buy, sell, etc.) */
  refresh: () => void;
}

const CurrencyContext = createContext<CurrencyState>({
  ryo: null,
  kitsu: null,
  refresh: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [ryo, setRyo] = useState<number | null>(null);
  const [kitsu, setKitsu] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getDashboard();
      setRyo(data.ryo);
      setKitsu(data.kitsu);
    } catch (err) {
      // 401 means not logged in — leave null, layout will redirect
      if (err instanceof ApiResponseError && err.status === 401) return;
      // Any other transient error: keep stale values
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CurrencyContext.Provider value={{ ryo, kitsu, refresh }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
