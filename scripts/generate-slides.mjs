// Renders a 16:9 PDF slide deck for each learning into public/slides/<slug>.pdf
//   npm run slides                 -> decks missing or older than their note
//   npm run slides -- <slug> ...   -> just these learnings
//   npm run slides -- --all        -> rebuild every deck
// Needs Playwright + Chromium (preinstalled in Claude Code cloud sessions).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { getLearnings, LEARNINGS_DIR, SLIDES_DIR, ROOT } from "../lib/content.mjs";
import { themeFor } from "../lib/themes.mjs";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    // Fall back to a globally installed copy.
    const { execSync } = require("node:child_process");
    const globalRoot = execSync("npm root -g").toString().trim();
    for (const dir of [globalRoot, "/opt/node-tools/node_modules"]) {
      try {
        return require(path.join(dir, "playwright"));
      } catch {}
    }
    throw new Error("Playwright not found. Install it with `npm i -g playwright && npx playwright install chromium`.");
  }
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Escape, then allow **bold** for emphasis.
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
// Split into the fewest groups of at most `max`, keeping group sizes even.
const chunk = (arr, max) => {
  const n = Math.ceil(arr.length / Math.ceil(arr.length / max));
  return Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
};
const pad = (n) => String(n).padStart(2, "0");
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

function fontFaces() {
  const dir = path.join(ROOT, "node_modules", "@fontsource", "inter", "files");
  return [400, 500, 600, 700, 800]
    .map((w) => {
      const file = path.join(dir, `inter-latin-${w}-normal.woff2`);
      return fs.existsSync(file)
        ? `@font-face{font-family:"Inter";font-weight:${w};src:url("${pathToFileURL(file)}") format("woff2");}`
        : "";
    })
    .join("\n");
}

function slidesFor(l) {
  const slides = [];

  slides.push(`
    <section class="slide cover">
      <div class="orb orb-a"></div><div class="orb orb-b"></div>
      <div class="content">
        <span class="pill">${esc(l.category)}</span>
        <h1 class="fit">${rich(l.title)}</h1>
        ${l.summary ? `<p class="lead">${rich(l.summary)}</p>` : ""}
        <div class="book">
          <div class="book-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg></div>
          <div><div class="book-title">${esc(l.book)}</div>${l.author ? `<div class="muted">by ${esc(l.author)}</div>` : ""}</div>
        </div>
      </div>
    </section>`);

  if (l.bigIdea) {
    slides.push(`
      <section class="slide big-idea">
        <div class="orb orb-c"></div>
        <div class="content">
          <div class="eyebrow">The big idea</div>
          <blockquote class="fit">${rich(l.bigIdea)}</blockquote>
        </div>
      </section>`);
  }

  l.concepts.forEach((c, i) => {
    slides.push(`
      <section class="slide concept">
        <div class="num">${pad(i + 1)}</div>
        <div class="content">
          <div class="eyebrow">Concept ${i + 1} of ${l.concepts.length}</div>
          <h2>${rich(c.title)}</h2>
          <div class="fit">
            <p class="body">${rich(c.explanation)}</p>
            ${c.example ? `<div class="example"><div class="example-label">In practice</div><p>${rich(c.example)}</p></div>` : ""}
          </div>
        </div>
      </section>`);
  });

  chunk(l.takeaways, 6).forEach((group, gi, all) => {
    slides.push(`
      <section class="slide takeaways">
        <div class="content">
          <div class="eyebrow">Key takeaways${all.length > 1 ? ` · ${gi + 1}/${all.length}` : ""}</div>
          <h2>What to remember</h2>
          <div class="grid fit ${group.length <= 2 ? "two" : ""}">
            ${group.map((t, i) => `<div class="card"><div class="card-num">${pad(gi * all[0].length + i + 1)}</div><p>${rich(t)}</p></div>`).join("")}
          </div>
        </div>
      </section>`);
  });

  chunk(l.actions, 6).forEach((group, gi, all) => {
    slides.push(`
      <section class="slide actions">
        <div class="content">
          <div class="eyebrow">Action plan${all.length > 1 ? ` · ${gi + 1}/${all.length}` : ""}</div>
          <h2>Put it into practice</h2>
          <ul class="checklist fit">
            ${group.map((a) => `<li><span class="check">✓</span><span>${rich(a)}</span></li>`).join("")}
          </ul>
        </div>
      </section>`);
  });

  chunk(l.quotes, 2).forEach((group) => {
    slides.push(`
      <section class="slide quotes">
        <div class="orb orb-b"></div>
        <div class="content">
          <div class="eyebrow">Worth quoting</div>
          <div class="quote-list fit ${group.length === 1 ? "one" : ""}">
            ${group.map((q) => `<figure><span class="qmark">“</span><p>${rich(q)}</p></figure>`).join("")}
          </div>
        </div>
      </section>`);
  });

  slides.push(`
    <section class="slide recap">
      <div class="orb orb-a"></div>
      <div class="content">
        <div class="eyebrow">In one line</div>
        <p class="recap-line fit">${rich(l.summary || l.bigIdea || l.title)}</p>
        ${l.tags.length ? `<div class="tags">${l.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>` : ""}
      </div>
    </section>`);

  return slides;
}

function deckHtml(l) {
  const t = themeFor(l.categorySlug);
  const slides = slidesFor(l);
  const footer = (i) =>
    `<footer><span>${esc(l.book)}${l.author ? ` · ${esc(l.author)}` : ""}</span><span class="brand">Learning Hub</span><span>${i + 1} / ${slides.length}</span></footer>`;
  const body = slides.map((s, i) => s.replace(/<\/section>\s*$/, `${footer(i)}</section>`)).join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
:root{--deep:${t.deep};--mid:${t.mid};--accent:${t.accent};--soft:${t.soft};--ink:#f8fafc;--muted:#cbd5e1}
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0b0d12}
body{font-family:"Inter",system-ui,sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{position:relative;width:1280px;height:720px;overflow:hidden;page-break-after:always;break-after:page;
  background:radial-gradient(1100px 700px at 100% 0%,${rgba(t.mid, 0.55)},${rgba(t.mid, 0)} 60%),
             radial-gradient(900px 600px at 0% 100%,${rgba(t.mid, 0.3)},${rgba(t.mid, 0)} 60%),
             linear-gradient(135deg,var(--deep),#07080c 75%)}
.slide::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(180deg,#000,transparent 70%)}
.content{position:absolute;inset:72px 96px 96px;display:flex;flex-direction:column;justify-content:center;gap:24px}
.orb{position:absolute;border-radius:50%;filter:blur(2px);opacity:.55}
.orb-a{width:520px;height:520px;right:-140px;top:-160px;background:radial-gradient(circle at 30% 30%,var(--accent),${rgba(t.accent, 0)} 65%)}
.orb-b{width:380px;height:380px;left:-120px;bottom:-140px;background:radial-gradient(circle at 60% 40%,var(--mid),${rgba(t.mid, 0)} 70%)}
.orb-c{width:700px;height:700px;right:-260px;bottom:-320px;background:radial-gradient(circle,${rgba(t.accent, 0.6)},${rgba(t.accent, 0)} 65%)}
.pill{align-self:flex-start;padding:8px 18px;border-radius:999px;font-size:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--deep);background:var(--accent)}
.eyebrow{font-size:18px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
h1{font-size:76px;line-height:1.12;padding-bottom:6px;font-weight:800;letter-spacing:-.03em;max-height:300px;max-width:1000px}
h2{font-size:48px;line-height:1.1;font-weight:800;letter-spacing:-.02em}
strong{color:var(--accent);font-weight:700}
.lead{font-size:26px;line-height:1.45;color:var(--muted);max-width:900px}
.muted{color:var(--muted);font-size:18px}
.book{display:flex;align-items:center;gap:16px;margin-top:16px;padding:16px 22px;align-self:flex-start;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.book-icon{color:var(--accent);display:grid}
.book-title{font-size:22px;font-weight:700}
.fit{overflow:hidden}
blockquote{font-size:56px;line-height:1.2;font-weight:700;letter-spacing:-.02em;max-height:440px;padding-left:36px;border-left:6px solid var(--accent)}
.concept .num{position:absolute;right:72px;top:40px;font-size:220px;font-weight:800;line-height:1;color:transparent;-webkit-text-stroke:2px ${rgba(t.accent, 0.45)}}
.concept .fit{display:flex;flex-direction:column;gap:24px;max-height:400px}
.concept h2{max-width:780px}
.concept .body{font-size:28px;line-height:1.5;color:#e2e8f0;max-width:840px}
.example{padding:22px 26px;border-radius:18px;background:${rgba(t.accent, 0.14)};border:1px solid ${rgba(t.accent, 0.4)};max-width:840px}
.example-label{font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
.example p{font-size:22px;line-height:1.5;color:var(--soft)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-height:440px}
.card{padding:26px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);display:flex;gap:18px;align-items:flex-start}
.card-num{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-weight:800;font-size:17px;color:var(--deep);background:var(--accent)}
.card p{font-size:22px;line-height:1.45}
.checklist{list-style:none;display:flex;flex-direction:column;gap:14px;max-height:440px}
.checklist li{display:flex;gap:18px;align-items:flex-start;font-size:25px;line-height:1.4;padding:16px 22px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.check{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:18px;font-weight:800;color:var(--deep);background:var(--accent);margin-top:2px}
.quote-list{display:flex;flex-direction:column;gap:32px;max-height:460px}
figure{display:flex;gap:24px;align-items:flex-start}
.qmark{flex:none;height:64px;overflow:hidden;font-family:Georgia,"DejaVu Serif",serif;font-size:120px;font-weight:700;color:var(--accent);line-height:.85}
.quote-list.one p{font-size:48px;line-height:1.25}
figure p{font-size:34px;line-height:1.35;font-weight:600;font-style:italic}
.recap-line{font-size:54px;line-height:1.2;font-weight:800;letter-spacing:-.02em;max-height:380px;max-width:1040px}
.tags{display:flex;flex-wrap:wrap;gap:10px}
.tags span{padding:8px 16px;border-radius:999px;font-size:18px;color:var(--soft);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}
footer{position:absolute;left:96px;right:96px;bottom:36px;display:flex;justify-content:space-between;font-size:15px;color:#94a3b8;border-top:1px solid rgba(255,255,255,.1);padding-top:14px}
footer .brand{font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--accent)}
.capture .content,.capture footer{visibility:hidden}
.slide.baked::before,.slide.baked .orb,.slide.baked .num{display:none}
</style></head><body>${body}</body></html>`;
}

// Shrink text in any .fit element until it no longer overflows.
async function fitText(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const el of document.querySelectorAll(".fit")) {
      const targets = [el, ...el.querySelectorAll("p,li,blockquote")];
      let scale = 1;
      while ((el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4) && scale > 0.45) {
        scale -= 0.04;
        for (const t of targets) {
          if (!t.dataset.base) t.dataset.base = parseFloat(getComputedStyle(t).fontSize);
          t.style.fontSize = `${t.dataset.base * scale}px`;
        }
      }
    }
  });
}

// pdf.js (used by the website viewer) mis-renders Chromium's semi-transparent
// gradients, so the decorative layer (gradients, orbs, big numbers) is
// screenshotted per slide and placed back as one JPEG background. Text stays
// real, selectable and searchable.
async function bakeBackgrounds(page) {
  await page.evaluate(() => document.body.classList.add("capture"));
  const slides = page.locator(".slide");
  const images = [];
  for (let i = 0; i < (await slides.count()); i++) {
    const buf = await slides.nth(i).screenshot({ type: "jpeg", quality: 88 });
    images.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
  }
  await page.evaluate((imgs) => {
    document.querySelectorAll(".slide").forEach((el, i) => {
      el.style.background = `url(${imgs[i]}) center / cover no-repeat`;
      el.classList.add("baked");
    });
    document.body.classList.remove("capture");
  }, images);
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const wanted = args.filter((a) => !a.startsWith("--"));
  const learnings = getLearnings().filter((l) => {
    if (wanted.length) return wanted.includes(l.slug);
    if (all) return true;
    const pdf = path.join(SLIDES_DIR, `${l.slug}.pdf`);
    return !fs.existsSync(pdf) || fs.statSync(pdf).mtimeMs < fs.statSync(path.join(LEARNINGS_DIR, `${l.slug}.md`)).mtimeMs;
  });
  const missing = wanted.filter((w) => !learnings.some((l) => l.slug === w));
  if (missing.length) console.warn(`! no learning named: ${missing.join(", ")}`);
  if (!learnings.length) return console.log("slides: nothing to generate");

  fs.mkdirSync(SLIDES_DIR, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "slides-"));
  try {
    for (const l of learnings) {
      const file = path.join(tmp, `${l.slug}.html`);
      fs.writeFileSync(file, deckHtml(l));
      await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
      await fitText(page);
      await bakeBackgrounds(page);
      const out = path.join(SLIDES_DIR, `${l.slug}.pdf`);
      await page.pdf({ path: out, width: "1280px", height: "720px", printBackground: true, preferCSSPageSize: true });
      console.log(`slides: ${path.relative(ROOT, out)}`);
    }
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
