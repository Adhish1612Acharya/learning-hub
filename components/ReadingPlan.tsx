"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { themeFor } from "@/lib/themes.mjs";
import { slugify } from "@/lib/slug.mjs";

export type PlanItem = {
  type: "book" | "action";
  title: string;
  slug: string;
  author: string;
  category: string;
  status: "completed" | "";
  start: string;
  end: string;
  finished: string;
  note: string;
  learningCount: number;
};
export type Goal = { title: string; deadline: string } | null;

type State = "done" | "now" | "next" | "planned" | "overdue";

const LABEL: Record<State, string> = { done: "Done", now: "Now", next: "Up next", planned: "Planned", overdue: "Past end date" };

// Statuses depend on today's date, so they are worked out in the browser:
// the static HTML was built on some earlier day.
function useToday() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date();
    setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, []);
  return today;
}

function states(items: PlanItem[], today: string | null): State[] {
  let nextGiven = false;
  return items.map((it) => {
    if (it.status === "completed") return "done";
    if (!today || !it.start) return "planned";
    if (today < it.start) {
      if (nextGiven) return "planned";
      nextGiven = true;
      return "next";
    }
    if (!it.end || today <= it.end) return "now";
    return "overdue";
  });
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", opts) : "";
const range = (it: PlanItem) => (it.start ? `${fmt(it.start)} – ${fmt(it.end)}` : it.finished ? `Finished ${fmt(it.finished)}` : "");
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86_400_000);

function Dot({ state, accent }: { state: State; accent: string }) {
  if (state === "done")
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: accent }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
    );
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-full border-2 ${state === "now" ? "animate-pulse" : ""}`}
      style={{ borderColor: state === "now" || state === "next" ? accent : "var(--border)", background: "var(--surface)" }}
    >
      {state === "now" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />}
    </span>
  );
}

export function ReadingPlan({ items, goal }: { items: PlanItem[]; goal: Goal }) {
  const today = useToday();
  const st = states(items, today);
  const books = items.filter((i) => i.type === "book");
  const done = books.filter((i) => i.status === "completed").length;
  const daysLeft = today && goal?.deadline ? daysBetween(today, goal.deadline) : null;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Reading plan</h2>
          {goal && (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {goal.title}
              {daysLeft !== null && daysLeft >= 0 && ` · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
            </p>
          )}
        </div>
        <p className="text-sm font-semibold">
          {done} / {books.length} books done
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg)]">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500" style={{ width: `${books.length ? (done / books.length) * 100 : 0}%` }} />
      </div>

      <ol className="mt-6">
        {items.map((it, i) => {
          const t = themeFor(slugify(it.category || "general"));
          const s = st[i];
          const last = i === items.length - 1;
          return (
            <li key={`${it.slug}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
              {!last && <span className="absolute left-[13px] top-8 h-[calc(100%-2rem)] w-0.5 bg-[var(--border)]" />}
              <Dot state={s} accent={t.mid} />
              <div className={`min-w-0 flex-1 ${s === "planned" ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {it.type === "book" ? (
                    <Link href={`/books/${it.slug}/`} className="font-bold leading-snug hover:underline">
                      {it.title}
                    </Link>
                  ) : (
                    <span className="font-bold leading-snug">{it.title}</span>
                  )}
                  {s !== "planned" && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                      style={
                        s === "overdue"
                          ? { background: "color-mix(in srgb, #f59e0b 22%, transparent)", color: "#b45309" }
                          : { background: `color-mix(in srgb, ${t.accent} 25%, transparent)`, color: `color-mix(in srgb, ${t.mid} 75%, var(--ink))` }
                      }
                    >
                      {LABEL[s]}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {[it.author, it.type === "action" ? "Action, no reading" : it.category, range(it)].filter(Boolean).join(" · ")}
                </p>
                {(it.note || it.learningCount > 0) && (
                  <p className="mt-1 text-sm">
                    {it.learningCount > 0 && (
                      <Link href={`/books/${it.slug}/`} className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
                        {it.learningCount} {it.learningCount === 1 ? "learning" : "learnings"}
                      </Link>
                    )}
                    {it.learningCount > 0 && it.note && " · "}
                    {it.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Compact card for the home page: what's being read right now. */
export function NowReading({ items }: { items: PlanItem[] }) {
  const today = useToday();
  if (!today) return null;
  const st = states(items, today);
  const i = st.indexOf("now") >= 0 ? st.indexOf("now") : st.indexOf("next");
  if (i < 0) return null;
  const it = items[i];
  const t = themeFor(slugify(it.category || "general"));
  const now = st[i] === "now";
  const days = now ? daysBetween(today, it.end) : daysBetween(today, it.start);

  return (
    <Link
      href="/books/"
      className="mb-8 flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:shadow-md"
    >
      <span className="grid h-11 w-11 flex-none place-items-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${t.mid}, ${t.deep})` }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
          <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          {now ? (it.type === "action" ? "Doing now" : "Reading now") : "Up next"}
        </span>
        <span className="block truncate font-bold">{it.title}</span>
        <span className="block text-sm text-[var(--muted)]">
          {range(it)}
          {now ? ` · ${days <= 0 ? "last day" : `${days} ${days === 1 ? "day" : "days"} left`}` : ` · starts in ${days} ${days === 1 ? "day" : "days"}`}
        </span>
      </span>
      <span className="hidden text-sm font-semibold text-[var(--muted)] sm:block">Reading plan →</span>
    </Link>
  );
}
