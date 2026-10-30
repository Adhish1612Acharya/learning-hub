import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooks } from "@/lib/content.mjs";
import { LearningCard } from "@/components/LearningCard";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  const slugs = getBooks().map((b) => ({ slug: b.slug }));
  return slugs.length ? slugs : [{ slug: "_none" }];
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = getBooks().find((x) => x.slug === slug);
  return b ? { title: b.title } : {};
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  const b = getBooks().find((x) => x.slug === slug);
  if (!b) notFound();

  return (
    <>
      <Link href="/books/" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
        ← All books
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">{b.title}</h1>
      {b.author && <p className="mt-2 text-lg text-[var(--muted)]">by {b.author}</p>}
      <p className="mt-1 text-sm text-[var(--muted)]">
        {b.learnings.length} {b.learnings.length === 1 ? "learning" : "learnings"} · {b.categories.join(" · ")}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {b.learnings.map((l) => (
          <LearningCard key={l.slug} l={l} />
        ))}
      </div>
    </>
  );
}
