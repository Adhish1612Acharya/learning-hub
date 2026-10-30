// Builds public/search-index.json from the learning notes AND the text inside
// every PDF in public/slides. Each note section and each PDF page becomes its
// own search document, so results can point at the exact passage or slide.
import fs from "node:fs";
import path from "node:path";
import { getLearnings, SLIDES_DIR, ROOT } from "../lib/content.mjs";

const OUT = path.join(ROOT, "public", "search-index.json");

function plain(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split the markdown body on headings so each section is its own chunk. */
function bodySections(body) {
  const sections = [];
  let heading = "In my words";
  let buf = [];
  const flush = () => {
    const text = plain(buf.join("\n"));
    if (text) sections.push({ heading, text });
    buf = [];
  };
  for (const line of body.split("\n")) {
    const m = line.match(/^#{1,6}\s+(.*)/);
    if (m) {
      flush();
      heading = m[1].trim();
    } else buf.push(line);
  }
  flush();
  return sections;
}

async function pdfPages(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items
      .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
      .join("")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    pages.push({ page: i, lines });
  }
  await doc.destroy();

  // Drop running headers/footers: lines (ignoring numbers) found on most pages.
  const key = (line) => line.replace(/\d+/g, "#");
  const seen = new Map();
  for (const p of pages) for (const k of new Set(p.lines.map(key))) seen.set(k, (seen.get(k) || 0) + 1);
  const repeated = (line) => pages.length >= 3 && seen.get(key(line)) > pages.length / 2;

  return pages
    .map((p) => ({ page: p.page, text: p.lines.filter((l) => !repeated(l)).join(" ") }))
    .filter((p) => p.text);
}

async function main() {
  const learnings = getLearnings();
  const docs = [];
  let id = 0;
  const add = (l, fields) =>
    docs.push({
      id: id++,
      slug: l?.slug ?? null,
      title: l?.title ?? fields.title,
      book: l?.book ?? "",
      author: l?.author ?? "",
      category: l?.category ?? "",
      tags: l?.tags.join(" ") ?? "",
      date: l?.date ?? "",
      ...fields,
    });

  for (const l of learnings) {
    add(l, {
      source: "note",
      heading: "Summary",
      text: [l.summary, l.bigIdea].filter(Boolean).join(" — "),
    });
    l.concepts.forEach((c) =>
      add(l, { source: "note", heading: c.title, text: [c.explanation, c.example].filter(Boolean).join(" Example: ") }),
    );
    if (l.takeaways.length) add(l, { source: "note", heading: "Key takeaways", text: l.takeaways.join(" • ") });
    if (l.actions.length) add(l, { source: "note", heading: "Action plan", text: l.actions.join(" • ") });
    if (l.quotes.length) add(l, { source: "note", heading: "Quotes", text: l.quotes.join(" • ") });
    for (const s of bodySections(l.body)) add(l, { source: "note", ...s });
  }

  // Every PDF in public/slides is indexed, page by page. PDFs named after a
  // learning slug are linked to that learning; any other PDF is indexed alone.
  const bySlug = new Map(learnings.map((l) => [l.slug, l]));
  const pdfs = fs.existsSync(SLIDES_DIR) ? fs.readdirSync(SLIDES_DIR).filter((f) => f.endsWith(".pdf")) : [];
  for (const f of pdfs) {
    const slug = f.replace(/\.pdf$/, "");
    const l = bySlug.get(slug);
    try {
      for (const p of await pdfPages(path.join(SLIDES_DIR, f))) {
        add(l, {
          source: "pdf",
          title: slug.replace(/[-_]+/g, " "),
          heading: `Slide ${p.page}`,
          page: p.page,
          pdf: `/slides/${f}`,
          text: p.text,
        });
      }
    } catch (err) {
      console.warn(`! could not read ${f}: ${err.message}`);
    }
  }

  // pdf.js worker for the in-page slide viewer.
  fs.copyFileSync(
    path.join(ROOT, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs"),
    path.join(ROOT, "public", "pdf.worker.min.mjs"),
  );

  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), docs }));
  console.log(`search index: ${learnings.length} learnings, ${pdfs.length} pdfs, ${docs.length} chunks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
