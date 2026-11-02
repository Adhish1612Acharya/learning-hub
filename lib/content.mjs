// Shared content loader. Plain JS so both Next.js (server components) and the
// Node scripts in /scripts can import it.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { slugify } from "./slug.mjs";

export { slugify };

export const ROOT = process.cwd();
export const LEARNINGS_DIR = path.join(ROOT, "content", "learnings");
export const SLIDES_DIR = path.join(ROOT, "public", "slides");

/**
 * @typedef {{ title: string, explanation: string, example?: string, icon?: string }} Concept
 * @typedef {{
 *   slug: string, title: string, book: string, bookSlug: string, author: string,
 *   category: string, categorySlug: string, tags: string[], date: string,
 *   summary: string, bigIdea: string, concepts: Concept[], takeaways: string[],
 *   actions: string[], quotes: string[], body: string, pdf: string | null, pptx: string | null
 * }} Learning
 */


function asList(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => String(v).trim()).filter(Boolean);
}

function asDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ? String(value) : "";
}

/** Files starting with "_" (like _template.md) are ignored. */
function learningFiles() {
  if (!fs.existsSync(LEARNINGS_DIR)) return [];
  return fs
    .readdirSync(LEARNINGS_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"));
}

/** @returns {Learning} */
function parseLearning(file) {
  const slug = file.replace(/\.md$/, "");
  const { data, content } = matter(fs.readFileSync(path.join(LEARNINGS_DIR, file), "utf8"));
  const book = String(data.book || "Unknown book");
  const category = String(data.category || "General");
  const pdfFile = path.join(SLIDES_DIR, `${slug}.pdf`);
  const pptxFile = path.join(SLIDES_DIR, `${slug}.pptx`);
  return {
    slug,
    title: String(data.title || slug),
    book,
    bookSlug: slugify(book),
    author: String(data.author || ""),
    category,
    categorySlug: slugify(category),
    tags: asList(data.tags),
    date: asDate(data.date),
    summary: String(data.summary || ""),
    bigIdea: String(data.bigIdea || ""),
    concepts: (Array.isArray(data.concepts) ? data.concepts : []).map((c) => ({
      title: String(c.title || ""),
      explanation: String(c.explanation || ""),
      ...(c.example ? { example: String(c.example) } : {}),
      ...(c.icon ? { icon: String(c.icon) } : {}),
    })),
    takeaways: asList(data.takeaways),
    actions: asList(data.actions),
    quotes: asList(data.quotes),
    body: content.trim(),
    pdf: fs.existsSync(pdfFile) ? `/slides/${slug}.pdf` : null,
    pptx: fs.existsSync(pptxFile) ? `/slides/${slug}.pptx` : null,
  };
}

/** All learnings, newest first. @returns {Learning[]} */
export function getLearnings() {
  return learningFiles()
    .map(parseLearning)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** @returns {Learning | undefined} */
export function getLearning(slug) {
  return getLearnings().find((l) => l.slug === slug);
}

/**
 * @typedef {{
 *   type: "book" | "action", title: string, slug: string, author: string, category: string,
 *   status: "completed" | "", start: string, end: string, finished: string, note: string,
 *   learningCount: number
 * }} PlanItem
 */

export const PLAN_FILE = path.join(ROOT, "content", "reading-plan.json");

/** The reading plan (content/reading-plan.json), in order, with learning counts per book. */
export function getReadingPlan() {
  if (!fs.existsSync(PLAN_FILE)) return { goal: null, items: [] };
  const raw = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
  const counts = new Map();
  for (const l of getLearnings()) counts.set(l.bookSlug, (counts.get(l.bookSlug) || 0) + 1);
  /** @type {PlanItem[]} */
  const items = (raw.items || []).map((it) => ({
    type: it.type === "action" ? "action" : "book",
    title: String(it.title || ""),
    slug: slugify(it.title || ""),
    author: String(it.author || ""),
    category: String(it.category || ""),
    status: it.status === "completed" ? "completed" : "",
    start: asDate(it.start),
    end: asDate(it.end),
    finished: asDate(it.finished),
    note: String(it.note || ""),
    learningCount: counts.get(slugify(it.title || "")) || 0,
  }));
  return { goal: raw.goal ? { title: String(raw.goal.title || ""), deadline: asDate(raw.goal.deadline) } : null, items };
}

/**
 * Books from the learnings and the reading plan, with their learnings.
 * @returns {{ slug: string, title: string, author: string, categories: string[], learnings: Learning[], plan: PlanItem | null }[]}
 */
export function getBooks() {
  /** @type {Map<string, { slug: string, title: string, author: string, categories: Set<string>, learnings: Learning[], plan: PlanItem | null }>} */
  const books = new Map();
  for (const item of getReadingPlan().items.filter((i) => i.type === "book")) {
    books.set(item.slug, {
      slug: item.slug,
      title: item.title,
      author: item.author,
      categories: new Set(item.category ? [item.category] : []),
      learnings: [],
      plan: item,
    });
  }
  for (const l of getLearnings()) {
    const b = books.get(l.bookSlug) || {
      slug: l.bookSlug,
      title: l.book,
      author: l.author,
      categories: new Set(),
      learnings: [],
      plan: null,
    };
    if (!b.author && l.author) b.author = l.author;
    b.categories.add(l.category);
    b.learnings.push(l);
    books.set(l.bookSlug, b);
  }
  return [...books.values()]
    .map((b) => ({ ...b, categories: [...b.categories] }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
