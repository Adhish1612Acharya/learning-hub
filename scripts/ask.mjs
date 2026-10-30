// CLI search over the same index the website uses.
//   npm run ask -- "how to save money"
// Rebuilds the index first so results always reflect the current content.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createIndex, search, groupResults, snippet } from "../lib/search.mjs";

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error('usage: npm run ask -- "your question"');
  process.exit(1);
}

execFileSync(process.execPath, [path.join("scripts", "build-index.mjs")], { stdio: "ignore" });
const { docs } = JSON.parse(fs.readFileSync(path.join("public", "search-index.json"), "utf8"));
const groups = groupResults(search(createIndex(docs), query)).slice(0, 5);

if (!groups.length) console.log("No matches.");
for (const g of groups) {
  console.log(`\n# ${g.title} — ${g.book}${g.author ? ` (${g.author})` : ""}  [score ${g.score.toFixed(1)}]`);
  if (g.slug) console.log(`  file: content/learnings/${g.slug}.md   page: /learnings/${g.slug}/`);
  for (const h of g.hits) {
    const s = snippet(h.text, h.terms);
    const text = s.parts.map((p) => (p.hit ? `**${p.text}**` : p.text)).join("");
    console.log(`  - [${h.source === "pdf" ? "slides" : "notes"} · ${h.heading}] ${s.before ? "…" : ""}${text}${s.after ? "…" : ""}`);
  }
}
