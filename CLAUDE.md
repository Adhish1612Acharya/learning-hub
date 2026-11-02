# Learning Hub — instructions for Claude

This repo is the owner's personal record of what they learn from books (finance, startups, self-help, …).
It is a **purely static** Next.js site (`output: "export"`). No server, no database: content lives in
Markdown files, and search runs in the browser from a JSON index built at build time.

There are two kinds of requests. Handle each as below.

## 1. "Here's what I learned…" → add a learning

The owner explains a learning in their own words. Turn it into a structured entry plus a slide deck.

1. **Ask which book it's from** unless the message names it — use AskUserQuestion. Build the options
   from `content/reading-plan.json`: the book scheduled for today first (marked Recommended), then the
   next one and the most recently finished one. The owner also adds notes from books finished before the
   hub existed (e.g. from summaries), so a finished book is a normal answer.
   Take `book`, `author` and `category` **exactly** from the plan entry so learnings group under the
   right book. For a book not in the plan, ask for title, author and category (themes exist for Finance,
   Startups, Self-Help, Psychology, Productivity, Business; others get a fallback colour) and add it
   to the plan.
2. **Create** `content/learnings/<YYYY-MM-DD>-<short-slug>.md` following `content/learnings/_template.md`:
   - `title`: short and memorable. `summary`: one sentence. `bigIdea`: the core insight as a strong statement.
   - `concepts`: each idea explained plainly, with an `example` when the owner gave one (or an obvious real-life one).
   - `takeaways`, `actions` (concrete things to do), `quotes` (optional), `tags` (lowercase, reuse existing tags).
   - Body under `## In my words`: the owner's explanation, lightly cleaned (fix grammar, keep their voice and
     meaning — don't add ideas they didn't say). Add `## Why it matters to me` only if they shared that.
   - Don't invent facts about the book. If something they said seems off, keep their version and ask.
   - `**bold**` and `*italic*` work inside frontmatter strings (slides and the page).
   - One file per distinct learning. Several learnings from one explanation → several files, same `book`.
3. **Generate the deck**: `npm run slides -- <slug>` builds a pitch-deck style PowerPoint
   (`public/slides/<slug>.pptx`, pptxgenjs) and converts it to `public/slides/<slug>.pdf` with LibreOffice.
   Follow the pptx skill's QA: `validate.py` on the .pptx, then render the PDF
   (`pdftoppm -jpeg -r 50 public/slides/<slug>.pdf <dir>/s`) and look at every slide for overflow/overlap.
   Text sizes are fitted to their boxes; if a slide still looks crowded, shorten that field.
   Give each concept an `icon` that matches its meaning (names in `_template.md`).
4. **Verify**: `npm run build` must pass.
5. **Commit and push** (note + PPTX + PDF together) on the working branch.
6. Reply with a short summary of how the learning was structured.

## Reading plan

`content/reading-plan.json` is the owner's reading list, in order: `goal` (title + deadline) and `items`.
Each item is a `book` (title, author, category, `start`/`end` dates, optional `note`) or an `action`
block with no reading (e.g. "message users"). The site shows it as a timeline on `/books` and a
"Reading now" card on the home page; "now / up next / done" are worked out in the browser from today's date.

- When the owner says they finished a book: set `"status": "completed"` and `"finished": "<date>"`.
- New books, reordering or new dates: edit the items; keep dates as `YYYY-MM-DD`.
- Every plan book gets a `/books/<slug>` page even before it has learnings.

## 2. "What did I learn about X?" → answer from the hub

1. Run `npm run ask -- "<question keywords>"` — same fuzzy search the website uses, over notes **and** PDF text.
   Also `grep -ril "<word>" content/learnings` for exact terms.
2. Read the matching `content/learnings/*.md` files in full.
3. Answer from the owner's own notes, citing the learning title and book. Say clearly when the hub has
   nothing on the topic rather than filling gaps from general knowledge (you may add general knowledge
   afterwards, labelled as such).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Build the search index, start dev server |
| `npm run slides` | PPTX + PDF decks for learnings that are new or changed (`-- <slug>` for one, `-- --all` for all) |
| `npm run pdf -- deck.pptx` | Convert any PPTX to PDF with LibreOffice (`--outdir dir` optional) |
| `npm run index` | Rebuild `public/search-index.json` (notes + every PDF in `public/slides`) |
| `npm run ask -- "query"` | CLI search over the hub |
| `npm run build` | Index + static export to `out/` |

## Layout

- `content/learnings/*.md` — the learnings (files starting with `_` are ignored).
- `content/reading-plan.json` — reading list with dates and status (see Reading plan).
- `public/slides/*.pptx|*.pdf` — generated decks, committed. Any other PDF dropped here is also indexed for search.
- `lib/content.mjs` — loads/parses learnings (shared by the site and scripts).
- `lib/search.mjs` — MiniSearch config, grouping and snippets (shared by the site and `npm run ask`).
- `lib/themes.mjs` — category colour themes (site + slides).
- `scripts/generate-slides.mjs` — builds the PPTX with pptxgenjs as a structured deck: theme colours per
  category, layouts COVER / STATEMENT / CONTENT with placeholders, sections. Slides: cover, big idea,
  ideas at a glance, one per concept, takeaways, action plan, quotes, recap. Icons come from react-icons (fa6).
- `scripts/pptx-to-pdf.mjs` — LibreOffice headless conversion (set `SOFFICE` if the binary isn't on PATH).
- `scripts/build-index.mjs` — builds the search index; drops repeated slide footers from PDF text.
- `components/ReadingPlan.tsx` — reading plan timeline and the home page "Reading now" card.
- `app/` — pages: `/` (search + filters), `/learnings/[slug]`, `/books` (reading plan + all books), `/books/[slug]`.
