import Link from "next/link";
import { themeFor } from "@/lib/themes.mjs";
import { formatDate } from "@/lib/site";

export type CardLearning = {
  slug: string;
  title: string;
  book: string;
  author: string;
  category: string;
  categorySlug: string;
  tags: string[];
  date: string;
  summary: string;
  pdf: string | null;
};

export function CategoryPill({ category, categorySlug }: { category: string; categorySlug: string }) {
  const t = themeFor(categorySlug);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ background: `color-mix(in srgb, ${t.accent} 22%, transparent)`, color: `color-mix(in srgb, ${t.mid} 70%, var(--ink))` }}
    >
      {category}
    </span>
  );
}

export function LearningCard({ l }: { l: CardLearning }) {
  const t = themeFor(l.categorySlug);
  return (
    <Link
      href={`/learnings/${l.slug}/`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${t.mid}, ${t.accent})` }} />
      <div className="flex items-center justify-between gap-2">
        <CategoryPill category={l.category} categorySlug={l.categorySlug} />
        {l.pdf && (
          <span className="text-xs font-medium text-[var(--muted)]" title="Has a slide deck">
            ▶ Slides
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-bold leading-snug tracking-tight group-hover:underline">{l.title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {l.book}
        {l.author && ` · ${l.author}`}
      </p>
      {l.summary && <p className="mt-3 line-clamp-3 text-sm leading-relaxed">{l.summary}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-xs text-[var(--muted)]">
        {l.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-md bg-[var(--bg)] px-1.5 py-0.5">
            #{tag}
          </span>
        ))}
        <span className="ml-auto">{formatDate(l.date)}</span>
      </div>
    </Link>
  );
}
