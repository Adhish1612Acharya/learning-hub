import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Learning Hub", template: "%s · Learning Hub" },
  description: "Everything I've learned from the books I read — structured notes, slide decks and search.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-indigo-500 text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
                  <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
                </svg>
              </span>
              Learning Hub
            </Link>
            <div className="flex items-center gap-1 text-sm font-medium">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]">
                Learnings
              </Link>
              <Link href="/books/" className="rounded-lg px-3 py-1.5 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]">
                Books
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-[var(--muted)] sm:px-6">
          Notes in my own words from the books I read.
        </footer>
      </body>
    </html>
  );
}
