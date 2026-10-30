"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type MiniSearch from "minisearch";
import { createIndex, groupResults, search, snippet } from "@/lib/search.mjs";
import { asset } from "@/lib/site";
import { CategoryPill, LearningCard, type CardLearning } from "./LearningCard";

type Source = "all" | "note" | "pdf";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
        active
          ? "border-transparent bg-[var(--ink)] text-[var(--bg)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function Snippet({ text, terms }: { text: string; terms: string[] }) {
  const s = snippet(text, terms);
  return (
    <>
      {s.before && "… "}
      {s.parts.map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
      {s.after && " …"}
    </>
  );
}

export default function Explorer({ learnings, books }: { learnings: CardLearning[]; books: { slug: string; title: string }[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [book, setBook] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("all");
  const [index, setIndex] = useState<MiniSearch | null>(null);
  const [indexError, setIndexError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bySlug = useMemo(() => new Map(learnings.map((l) => [l.slug, l])), [learnings]);
  const categories = useMemo(() => {
    const m = new Map<string, { name: string; slug: string; count: number }>();
    for (const l of learnings) {
      const c = m.get(l.categorySlug) || { name: l.category, slug: l.categorySlug, count: 0 };
      c.count++;
      m.set(l.categorySlug, c);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [learnings]);
  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of learnings) for (const t of l.tags) m.set(t, (m.get(t) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [learnings]);

  // Read ?q= / filters from the URL once, then keep the URL in sync.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQuery(p.get("q") || "");
    setCategory(p.get("category"));
    setBook(p.get("book") || "");
    setTag(p.get("tag"));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (category) p.set("category", category);
    if (book) p.set("book", book);
    if (tag) p.set("tag", tag);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [query, category, book, tag]);

  useEffect(() => {
    fetch(asset("/search-index.json"))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setIndex(createIndex(data.docs)))
      .catch(() => setIndexError(true));
  }, []);

  const passes = (l: CardLearning | undefined) => {
    if (!l) return !category && !book && !tag; // standalone PDFs only show without filters
    if (category && l.categorySlug !== category) return false;
    if (book && l.book !== books.find((b) => b.slug === book)?.title) return false;
    if (tag && !l.tags.includes(tag)) return false;
    return true;
  };

  const filtered = learnings.filter(passes);
  const groups = useMemo(() => {
    if (!index || !query.trim()) return [];
    const hits = search(index, query, (r: any) => (source === "all" || r.source === source) && passes(r.slug ? bySlug.get(r.slug) : undefined));
    return groupResults(hits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, query, source, category, book, tag]);

  const anyFilter = category || book || tag || source !== "all";
  const searching = query.trim().length > 0;

  return (
    <div>
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes and slides… e.g. “compounding”, “habits”, “raise money”"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-4 pl-12 pr-14 text-base shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20"
          aria-label="Search learnings"
        />
        <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--border)] px-1.5 text-xs text-[var(--muted)] sm:block">/</kbd>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={!category} onClick={() => setCategory(null)}>
            All topics
          </Chip>
          {categories.map((c) => (
            <Chip key={c.slug} active={category === c.slug} onClick={() => setCategory(category === c.slug ? null : c.slug)}>
              {c.name} <span className="opacity-60">{c.count}</span>
            </Chip>
          ))}
          <select
            value={book}
            onChange={(e) => setBook(e.target.value)}
            className="w-full rounded-full sm:ml-auto sm:w-auto border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
            aria-label="Filter by book"
          >
            <option value="">All books</option>
            {books.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map(([t, n]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? null : t)}
                className={`rounded-md px-2 py-0.5 text-xs transition ${tag === t ? "bg-emerald-500 text-white" : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"}`}
              >
                #{t} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}
        {searching && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Search in:</span>
            {(["all", "note", "pdf"] as Source[]).map((s) => (
              <Chip key={s} active={source === s} onClick={() => setSource(s)}>
                {s === "all" ? "Everything" : s === "note" ? "Notes" : "Slide PDFs"}
              </Chip>
            ))}
          </div>
        )}
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setBook("");
              setTag(null);
              setSource("all");
            }}
            className="self-start text-sm text-[var(--muted)] underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-8">
        {searching ? (
          indexError ? (
            <p className="text-[var(--muted)]">Search index not found. Run <code>npm run index</code>.</p>
          ) : !index ? (
            <p className="text-[var(--muted)]">Loading search…</p>
          ) : groups.length === 0 ? (
            <p className="text-[var(--muted)]">No matches for “{query}”. Try fewer or different words.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-[var(--muted)]">
                {groups.length} closest {groups.length === 1 ? "match" : "matches"}, best first
              </p>
              <ol className="flex flex-col gap-4">
                {groups.map((g, gi) => {
                  const l = g.slug ? bySlug.get(g.slug) : undefined;
                  return (
                    <li key={g.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {gi === 0 && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">Best match</span>}
                        {l && <CategoryPill category={l.category} categorySlug={l.categorySlug} />}
                      </div>
                      {l ? (
                        <Link href={`/learnings/${l.slug}/`} className="mt-2 block text-lg font-bold tracking-tight hover:underline">
                          {g.title}
                        </Link>
                      ) : (
                        <a href={asset(g.hits[0].pdf)} target="_blank" rel="noreferrer" className="mt-2 block text-lg font-bold capitalize tracking-tight hover:underline">
                          {g.title} (PDF)
                        </a>
                      )}
                      {g.book && (
                        <p className="text-sm text-[var(--muted)]">
                          {g.book}
                          {g.author && ` · ${g.author}`}
                        </p>
                      )}
                      <ul className="mt-3 flex flex-col gap-2">
                        {g.hits.map((h: any) => {
                          const href =
                            h.source === "pdf"
                              ? l
                                ? `/learnings/${l.slug}/#slide=${h.page}`
                                : asset(`${h.pdf}#page=${h.page}`)
                              : `/learnings/${l?.slug}/`;
                          const label = h.source === "pdf" ? `Slides · ${h.heading}` : h.heading;
                          return (
                            <li key={h.id} className="rounded-xl bg-[var(--bg)] px-3.5 py-2.5 text-sm leading-relaxed">
                              <span className="mr-2 inline-block rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs font-semibold text-[var(--muted)]">
                                {h.source === "pdf" ? "📄 " : "📝 "}
                                {label}
                              </span>
                              {h.source === "pdf" && !l ? (
                                <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
                                  <Snippet text={h.text} terms={h.terms} />
                                </a>
                              ) : (
                                <Link href={href} className="hover:underline">
                                  <Snippet text={h.text} terms={h.terms} />
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            </>
          )
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
            {learnings.length === 0 ? "No learnings yet — the first one is on its way." : "Nothing matches these filters."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => (
              <LearningCard key={l.slug} l={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
