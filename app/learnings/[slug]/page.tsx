import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { getLearning, getLearnings } from "@/lib/content.mjs";
import { themeFor } from "@/lib/themes.mjs";
import { formatDate } from "@/lib/site";
import { CategoryPill } from "@/components/LearningCard";
import SlideViewer from "@/components/SlideViewer";

type Props = { params: Promise<{ slug: string }> };

// Static export needs at least one path; a placeholder 404s when there are no learnings yet.
export function generateStaticParams() {
  const slugs = getLearnings().map((l) => ({ slug: l.slug }));
  return slugs.length ? slugs : [{ slug: "_none" }];
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = getLearning((await params).slug);
  return l ? { title: l.title, description: l.summary } : {};
}

// Inline **bold** only, escaped otherwise.
function Rich({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: marked.parseInline(text, { async: false }) }} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">{title}</h2>
      {children}
    </section>
  );
}

export default async function LearningPage({ params }: Props) {
  const l = getLearning((await params).slug);
  if (!l) notFound();
  const t = themeFor(l.categorySlug);
  const all = getLearnings();
  const sameBook = all.filter((x) => x.bookSlug === l.bookSlug && x.slug !== l.slug);

  return (
    <article style={{ ["--accent" as string]: t.accent }} className="mx-auto max-w-3xl">
      <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
        ← All learnings
      </Link>

      <header
        className="relative mt-4 overflow-hidden rounded-3xl p-7 text-white sm:p-10"
        style={{ background: `radial-gradient(600px 300px at 100% 0%, ${t.mid}, transparent 70%), linear-gradient(135deg, ${t.deep}, #07080c)` }}
      >
        <span className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider" style={{ background: t.accent, color: t.deep }}>
          {l.category}
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{l.title}</h1>
        {l.summary && <p className="mt-4 text-lg text-white/75">{l.summary}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/70">
          <Link href={`/books/${l.bookSlug}/`} className="font-semibold text-white hover:underline">
            {l.book}
          </Link>
          {l.author && <span>by {l.author}</span>}
          <span>{formatDate(l.date)}</span>
        </div>
        {l.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {l.tags.map((tag) => (
              <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} className="rounded-md bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20">
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </header>

      {l.pdf && (
        <Section title="Slide deck">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] shadow-lg">
            <SlideViewer pdf={l.pdf} title={l.title} />
          </div>
        </Section>
      )}

      {l.bigIdea && (
        <Section title="The big idea">
          <blockquote className="border-l-4 border-[var(--accent)] pl-5 text-xl font-semibold leading-relaxed sm:text-2xl">
            <Rich text={l.bigIdea} />
          </blockquote>
        </Section>
      )}

      {l.concepts.length > 0 && (
        <Section title="Concepts">
          <div className="flex flex-col gap-4">
            {l.concepts.map((c, i) => (
              <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-baseline gap-3">
                  <span className="font-extrabold text-[var(--accent)]">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-lg font-bold">{c.title}</h3>
                </div>
                <p className="mt-2 leading-relaxed">
                  <Rich text={c.explanation} />
                </p>
                {c.example && (
                  <p className="mt-3 rounded-xl px-4 py-3 text-sm leading-relaxed" style={{ background: `color-mix(in srgb, ${t.accent} 14%, transparent)` }}>
                    <span className="mr-1 font-bold">In practice:</span>
                    <Rich text={c.example} />
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {l.takeaways.length > 0 && (
        <Section title="Key takeaways">
          <ul className="grid gap-3 sm:grid-cols-2">
            {l.takeaways.map((x, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-md text-xs font-bold" style={{ background: t.accent, color: t.deep }}>
                  {i + 1}
                </span>
                <Rich text={x} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {l.actions.length > 0 && (
        <Section title="Action plan">
          <ul className="flex flex-col gap-2">
            {l.actions.map((x, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 leading-relaxed">
                <span className="font-bold text-[var(--accent)]">✓</span>
                <Rich text={x} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {l.quotes.length > 0 && (
        <Section title="Worth quoting">
          <div className="flex flex-col gap-3">
            {l.quotes.map((q, i) => (
              <blockquote key={i} className="text-lg italic text-[var(--muted)]">
                “<Rich text={q} />”
              </blockquote>
            ))}
          </div>
        </Section>
      )}

      {l.body && (
        <Section title="My notes">
          <div className="note-body" dangerouslySetInnerHTML={{ __html: marked.parse(l.body, { async: false }) }} />
        </Section>
      )}

      {sameBook.length > 0 && (
        <Section title={`More from ${l.book}`}>
          <ul className="flex flex-col gap-2">
            {sameBook.map((x) => (
              <li key={x.slug}>
                <Link href={`/learnings/${x.slug}/`} className="font-semibold hover:underline">
                  {x.title}
                </Link>
                <span className="text-sm text-[var(--muted)]"> — {x.summary}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-12">
        <CategoryPill category={l.category} categorySlug={l.categorySlug} />
      </div>
    </article>
  );
}
