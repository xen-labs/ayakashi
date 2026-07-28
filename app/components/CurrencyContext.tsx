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
      // Dashboard response is nested: currency.ryo / currency.kitsu
      setRyo(data.currency.ryo);
      setKitsu(data.currency.kitsu);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) return;
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
