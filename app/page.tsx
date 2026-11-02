import { getBooks, getLearnings, getReadingPlan } from "@/lib/content.mjs";
import Explorer from "@/components/Explorer";
import { NowReading } from "@/components/ReadingPlan";

export default function Home() {
  const learnings = getLearnings().map(({ concepts, takeaways, actions, quotes, body, bigIdea, ...card }) => card);
  const books = getBooks().map((b) => ({ slug: b.slug, title: b.title }));
  const noteBooks = new Set(learnings.map((l) => l.book)).size;
  const plan = getReadingPlan();

  return (
    <>
      <section className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">What I&apos;ve learned</h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)] sm:text-lg">
          {learnings.length} {learnings.length === 1 ? "learning" : "learnings"} from {noteBooks}{" "}
          {noteBooks === 1 ? "book" : "books"}. Search across my notes and every slide deck.
        </p>
      </section>
      <NowReading items={plan.items} />
      <Explorer learnings={learnings} books={books} />
    </>
  );
}
