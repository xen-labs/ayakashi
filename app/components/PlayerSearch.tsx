"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { searchPlayers, ApiResponseError } from "../../lib/api";
import type { PlayerSearchResult } from "../../lib/api";
import { getStaticAvatarUrl } from "./staticAvatarUrl";

interface Props {
  /** Render as a full standalone section (default) or a compact inline search bar */
  compact?: boolean;
  onSelect?: (result: PlayerSearchResult) => void;
  placeholder?: string;
}

export function PlayerSearch({
  compact = false,
  onSelect,
  placeholder = "Search players…",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = async (q: string, p: number) => {
    if (q.trim().length < 2) {
      setResults([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await searchPlayers(q.trim(), p);
      setResults(res.results);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (
        err instanceof ApiResponseError &&
        err.error.code === "query_too_short"
      ) {
        setResults([]);
      } else {
        setError("Search failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, 1), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const clear = () => {
    setQuery("");
    setResults([]);
    setError("");
    setPage(1);
    setTotalPages(1);
  };

  const ResultRow = ({
    r,
    index,
  }: {
    r: PlayerSearchResult;
    index: number;
  }) => {
    const inner = (
      <div
        className="search-row-in group flex items-center gap-3 border-b border-[rgba(200,168,75,0.08)] px-3 py-2.5 transition-all last:border-0 hover:bg-[rgba(200,168,75,0.05)] hover:pl-4"
        style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
      >
        <div className="h-8 w-8 shrink-0 overflow-hidden border border-[rgba(200,168,75,0.20)] bg-[rgba(200,168,75,0.05)] transition-transform group-hover:scale-105 group-hover:border-[rgba(200,168,75,0.45)]">
          {r.avatarUrl ? (
            // [FIXED] Was rendering r.avatarUrl raw — an animated
            // GIF/MP4/WEBM avatar would autoplay for every visible
            // search result at once. Search results are exactly the
            // dense/incidental context that should stay static — see
            // staticAvatarUrl.ts's header for the leaderboard-only
            // carve-out.
            <Image
              src={getStaticAvatarUrl(r.avatarUrl, "friendsList")}
              alt={r.displayName}
              width={32}
              height={32}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[rgba(200,168,75,0.40)]">
              {r.displayName[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold text-[#f0e6c8] transition-colors group-hover:text-[#e6c96a]">
            {r.displayName}
          </span>
          <span className="text-[10px] text-[rgba(200,168,75,0.40)]">
            @{r.username}
          </span>
        </div>
      </div>
    );

    if (onSelect) {
      return (
        <button
          type="button"
          className="w-full text-left"
          onClick={() => onSelect(r)}
        >
          {inner}
        </button>
      );
    }
    return <Link href={`/profile/${r.username}`}>{inner}</Link>;
  };

  const showResults =
    results.length > 0 || loading || error !== "" || query.length >= 2;

  if (compact) {
    return (
      <div className="relative w-full">
        <div className="flex items-center gap-2 border border-[rgba(200,168,75,0.25)] bg-black/40 px-3 transition-all focus-within:border-[#c8a84b] focus-within:shadow-[0_0_10px_rgba(200,168,75,0.15)]">
          <Search
            className={`h-3.5 w-3.5 shrink-0 text-[rgba(200,168,75,0.40)] transition-colors ${loading ? "search-loading-ring rounded-full text-[#c8a84b]" : ""}`}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-9 flex-1 bg-transparent text-sm text-[#f0e6c8] outline-none placeholder:text-[rgba(200,168,75,0.30)]"
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              className="text-[rgba(200,168,75,0.40)] hover:text-[#c8a84b]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {showResults && (
          <div className="absolute left-0 right-0 top-full z-30 border border-[rgba(200,168,75,0.25)] border-t-0 bg-[#0d0c00] shadow-xl">
            {loading && (
              <p className="px-4 py-3 text-xs text-[rgba(200,168,75,0.40)]">
                Searching…
              </p>
            )}
            {error && <p className="px-4 py-3 text-xs text-red-400">{error}</p>}
            {!loading &&
              results.length === 0 &&
              query.length >= 2 &&
              !error && (
                <p className="px-4 py-3 text-xs text-[rgba(200,168,75,0.40)]">
                  No players found.
                </p>
              )}
            {results.map((r, i) => (
              <ResultRow key={r.username} r={r} index={i} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Full-page mode ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border border-[rgba(200,168,75,0.25)] bg-black/40 px-3 transition-all focus-within:border-[#c8a84b] focus-within:shadow-[0_0_12px_rgba(200,168,75,0.18)]">
        <Search
          className={`h-4 w-4 shrink-0 text-[rgba(200,168,75,0.40)] transition-colors ${loading ? "search-loading-ring rounded-full text-[#c8a84b]" : ""}`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-11 flex-1 bg-transparent text-sm text-[#f0e6c8] outline-none placeholder:text-[rgba(200,168,75,0.30)]"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="text-[rgba(200,168,75,0.40)] transition-transform hover:scale-110 hover:text-[#c8a84b]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex h-20 items-center justify-center">
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
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && query.length >= 2 && results.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-6 text-center [animation:number-tick_0.2s_ease-out]">
          <Search className="h-5 w-5 text-[rgba(200,168,75,0.25)]" />
          <p className="text-sm text-[rgba(200,168,75,0.40)]">
            No players found for &quot;{query}&quot;.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="form-card border">
            {results.map((r, i) => (
              <ResultRow key={r.username} r={r} index={i} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => doSearch(query, page - 1)}
                className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-all hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              >
                ← Prev
              </button>
              <span className="text-xs text-[rgba(200,168,75,0.40)]">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => doSearch(query, page + 1)}
                className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-all hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
