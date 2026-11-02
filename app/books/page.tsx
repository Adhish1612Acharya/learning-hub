import type { Metadata } from "next";
import Link from "next/link";
import { getBooks, getReadingPlan, slugify } from "@/lib/content.mjs";
import { ReadingPlan } from "@/components/ReadingPlan";
import { formatShort } from "@/lib/site";
import { themeFor } from "@/lib/themes.mjs";

export const metadata: Metadata = { title: "Books" };

export default function BooksPage() {
  const books = getBooks();
  const plan = getReadingPlan();
  const finished = books.filter((b) => b.plan?.status === "completed" || (!b.plan && b.learnings.length)).length;
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Books</h1>
      <p className="mt-3 text-[var(--muted)] sm:text-lg">
        {finished} {finished === 1 ? "book" : "books"} read so far.
      </p>
      {plan.items.length > 0 && (
        <div className="mt-8">
          <ReadingPlan items={plan.items} goal={plan.goal} />
        </div>
      )}
      <h2 className="mt-12 text-xl font-extrabold tracking-tight sm:text-2xl">All books</h2>
      {books.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">No books yet.</div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => {
            const t = themeFor(slugify(b.categories[0] || "general"));
            return (
              <Link
                key={b.slug}
                href={`/books/${b.slug}/`}
                className="group flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div
                  className="flex h-28 w-20 flex-none items-end rounded-lg p-2 text-[10px] font-bold leading-tight text-white shadow-md"
                  style={{ background: `linear-gradient(160deg, ${t.mid}, ${t.deep})` }}
                >
                  {b.title}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold leading-snug group-hover:underline">{b.title}</h2>
                  {b.author && <p className="text-sm text-[var(--muted)]">{b.author}</p>}
                  <p className="mt-2 text-sm">
                    {b.learnings.length
                      ? `${b.learnings.length} ${b.learnings.length === 1 ? "learning" : "learnings"}`
                      : "No notes yet"}
                  </p>
                  {b.plan && (
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                      {b.plan.status === "completed" ? "✓ Finished" : b.plan.start ? `Planned ${formatShort(b.plan.start)} – ${formatShort(b.plan.end)}` : "On the list"}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--muted)]">{b.categories.join(" · ")}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
