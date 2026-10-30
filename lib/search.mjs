// Search engine shared by the website (browser) and `npm run ask` (Node).
import MiniSearch from "minisearch";

/**
 * @typedef {{
 *   id: number, slug: string | null, title: string, book: string, author: string,
 *   category: string, tags: string, date: string, source: "note" | "pdf",
 *   heading: string, text: string, page?: number, pdf?: string
 * }} SearchDoc
 */

export function createIndex(/** @type {SearchDoc[]} */ docs) {
  const ms = new MiniSearch({
    fields: ["title", "heading", "text", "book", "author", "tags", "category"],
    storeFields: ["slug", "title", "book", "author", "category", "tags", "date", "source", "heading", "text", "page", "pdf"],
  });
  ms.addAll(docs);
  return ms;
}

/**
 * Ranked search. Fuzzy + prefix so typos and partial words still find the
 * nearest matches. `filter` receives the stored fields of each hit.
 */
export function search(ms, query, filter) {
  if (!query.trim()) return [];
  return ms.search(query, {
    prefix: (term) => term.length > 2,
    fuzzy: (term) => (term.length > 4 ? 0.25 : 0),
    boost: { title: 3, heading: 2, book: 2, tags: 2, author: 1.5 },
    combineWith: "OR",
    filter,
  });
}

/** Group chunk hits by learning (or by PDF for standalone PDFs). */
export function groupResults(hits, perGroup = 3) {
  const groups = new Map();
  for (const h of hits) {
    const key = h.slug ?? h.pdf;
    const g = groups.get(key) || { key, slug: h.slug, title: h.title, book: h.book, author: h.author, category: h.category, date: h.date, score: 0, hits: [] };
    g.score = Math.max(g.score, h.score);
    if (g.hits.length < perGroup) g.hits.push(h);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.score - a.score);
}

/** @typedef {{ text: string, hit: boolean }} SnippetPart */

/**
 * Pick the window of `text` that contains the most matched terms and return
 * it split into plain / highlighted parts.
 * @param {string} text
 * @param {string[]} terms
 * @returns {{ parts: SnippetPart[], before: boolean, after: boolean }}
 */
export function snippet(text, terms, size = 220) {
  const lower = text.toLowerCase();
  const positions = [];
  for (const t of terms) {
    let i = lower.indexOf(t);
    while (i !== -1) {
      positions.push([i, t.length]);
      i = lower.indexOf(t, i + 1);
    }
  }
  positions.sort((a, b) => a[0] - b[0]);
  let start = 0;
  if (positions.length) {
    let best = 0;
    for (const [p] of positions) {
      const count = positions.filter(([q]) => q >= p && q < p + size).length;
      if (count > best) {
        best = count;
        start = p;
      }
    }
    start = Math.max(0, start - 60);
    const space = text.lastIndexOf(" ", start);
    if (start > 0 && space > start - 20) start = space + 1;
  }
  const end = Math.min(text.length, start + size);
  const window = text.slice(start, end);
  const re = terms.length
    ? new RegExp(`(${[...terms].sort((x, y) => y.length - x.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi")
    : null;
  const parts = re
    ? window.split(re).map((s) => ({ text: s, hit: terms.includes(s.toLowerCase()) }))
    : [{ text: window, hit: false }];
  return { parts, before: start > 0, after: end < text.length };
}
