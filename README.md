# Learning Hub

My personal record of what I learn from books — finance, startups, self-help and more.
Every learning is written in my own words, structured into concepts, takeaways and actions,
and turned into a pitch-deck style slide deck (PowerPoint + PDF).

- **Search** across all notes *and* the text inside every slide PDF. Fuzzy matching finds the
  closest matches even with typos, ranked best first, with highlighted snippets. Slide hits open
  the deck at that exact slide.
- **Filters** by topic, book and tag (also shareable via the URL, e.g. `/?q=compounding&category=finance`).
- **Books** page groups learnings by book.
- **Purely static** — `next build` exports plain HTML to `out/`; host anywhere.

## Adding a learning

Explain what I learned to Claude Code in this repo. It asks for the book, writes
`content/learnings/<date>-<slug>.md`, generates `public/slides/<slug>.pptx` and its PDF, and pushes.
See [CLAUDE.md](CLAUDE.md) for the full workflow and `content/learnings/_template.md` for the format.

## Commands

```bash
npm install
npm run dev                         # http://localhost:3000
npm run slides -- <slug>            # (re)generate PPTX + PDF; needs LibreOffice
npm run pdf -- deck.pptx            # convert any PPTX to PDF
npm run ask -- "how to save money"  # search from the terminal
npm run build                       # static site in out/
```

## Deploy

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`
(enable it once in *Settings → Pages → Source: GitHub Actions*).

**Vercel:** import the repo; `vercel.json` sets it up (static build, `npm run build`, output dir `out`).
Other static hosts (Netlify, Cloudflare Pages) work with the same build command and output dir.
