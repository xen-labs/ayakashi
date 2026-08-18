"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCards, getCardEvents, ApiResponseError } from "../../../lib/api";
import type { CatalogCard, CatalogSort } from "../../../lib/api";
import { CardTile } from "../../components/CardTile";

const RARITIES: { value: string; label: string }[] = [
  { value: "C", label: "Common" },
  { value: "R", label: "Rare" },
  { value: "SR", label: "Super Rare" },
  { value: "SSR", label: "Super Super Rare" },
  { value: "UR", label: "Ultra Rare" },
];

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "owners_desc", label: "Most Owned" },
  { value: "owners_asc", label: "Least Owned" },
  { value: "wishlist_desc", label: "Most Wishlisted" },
  { value: "issued_desc", label: "Most Issued" },
];

function SkeletonTile() {
  return (
    <div className="aspect-[3/4] w-full animate-pulse bg-[rgba(200,168,75,0.06)]" />
  );
}

export default function CardsPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [rarities, setRarities] = useState<Set<string>>(new Set());
  const [eventOnly, setEventOnly] = useState(false);
  const [eventName, setEventName] = useState<string>("");
  const [events, setEvents] = useState<string[]>([]);
  const [sort, setSort] = useState<CatalogSort>("newest");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [results, setResults] = useState<CatalogCard[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce free-text search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Load distinct event names once, for the filter dropdown
  useEffect(() => {
    getCardEvents()
      .then((res) => setEvents(res.events))
      .catch(() => null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCards({
        q: debouncedQuery || undefined,
        rarity: rarities.size ? Array.from(rarities).join(",") : undefined,
        isEvent: eventName ? undefined : eventOnly || undefined,
        eventName: eventName || undefined,
        sort,
        page,
      });
      setResults(res.results);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (err instanceof ApiResponseError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError("Couldn't load the card catalog. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, rarities, eventOnly, eventName, sort, page, router]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRarity = (r: string) => {
    setPage(1);
    setRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const activeFilterCount = rarities.size + (eventOnly || eventName ? 1 : 0);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="section-header">
        <span className="section-header-text">Card Catalog</span>
      </div>

      {/* ── Search + sort + filter toggle ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by card or series name…"
            className="form-input h-11 w-full border px-4 pr-10 text-sm outline-none transition-colors placeholder:text-[rgba(200,168,75,0.25)] focus:border-[#c8a84b]"
          />
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(200,168,75,0.4)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as CatalogSort);
            setPage(1);
          }}
          className="form-select h-11 border px-3 text-xs uppercase tracking-widest outline-none focus:border-[#c8a84b]"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={`flex h-11 shrink-0 items-center justify-center gap-2 border px-4 text-xs font-bold uppercase tracking-widest transition-colors ${
            filtersOpen || activeFilterCount > 0
              ? "border-[#c8a84b] text-[#c8a84b]"
              : "border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.6)] hover:border-[#c8a84b] hover:text-[#c8a84b]"
          }`}
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#c8a84b] text-[10px] font-bold text-black">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Filter panel ── */}
      {filtersOpen && (
        <div className="form-card flex flex-col gap-4 border p-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[rgba(200,168,75,0.55)]">
              Rarity
            </p>
            <div className="flex flex-wrap gap-2">
              {RARITIES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleRarity(r.value)}
                  className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                    rarities.has(r.value)
                      ? "border-[#c8a84b] bg-[rgba(200,168,75,0.15)] text-[#c8a84b]"
                      : "border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.55)] hover:border-[#c8a84b] hover:text-[#c8a84b]"
                  }`}
                  title={r.label}
                >
                  {r.value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[rgba(200,168,75,0.55)]">
              Events
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEventOnly((v) => !v);
                  setEventName("");
                  setPage(1);
                }}
                className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                  eventOnly && !eventName
                    ? "border-[#c8a84b] bg-[rgba(200,168,75,0.15)] text-[#c8a84b]"
                    : "border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.55)] hover:border-[#c8a84b] hover:text-[#c8a84b]"
                }`}
              >
                Any Event
              </button>
              {events.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => {
                    setEventName((prev) => (prev === ev ? "" : ev));
                    setEventOnly(false);
                    setPage(1);
                  }}
                  className={`border px-3 py-1.5 text-xs font-medium transition-colors ${
                    eventName === ev
                      ? "border-[#c8a84b] bg-[rgba(200,168,75,0.15)] text-[#c8a84b]"
                      : "border-[rgba(200,168,75,0.25)] text-[rgba(200,168,75,0.55)] hover:border-[#c8a84b] hover:text-[#c8a84b]"
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setRarities(new Set());
                setEventOnly(false);
                setEventName("");
                setPage(1);
              }}
              className="self-start text-xs font-semibold text-[rgba(200,168,75,0.55)] underline underline-offset-2 transition-colors hover:text-[#c8a84b]"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Result count ── */}
      {!loading && !error && (
        <p className="text-xs uppercase tracking-widest text-[rgba(200,168,75,0.40)]">
          {totalCount.toLocaleString("en-US")} card
          {totalCount === 1 ? "" : "s"}
        </p>
      )}

      {/* ── Grid ── */}
      {error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-[rgba(200,168,75,0.60)]">{error}</p>
          <button type="button" onClick={load} className="brush-btn w-40">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <SkeletonTile key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-[rgba(200,168,75,0.50)]">
            No cards match your search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((card) => (
            <CardTile key={card.shortId} card={card} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-xs text-[rgba(200,168,75,0.40)]">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-9 border border-[rgba(200,168,75,0.30)] px-5 text-xs font-bold uppercase tracking-widest text-[rgba(200,168,75,0.65)] transition-colors hover:border-[#c8a84b] hover:text-[#c8a84b] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
