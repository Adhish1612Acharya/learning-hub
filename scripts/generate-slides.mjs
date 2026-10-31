// Builds a pitch-deck style PowerPoint for each learning with pptxgenjs, then
// converts it to PDF with LibreOffice (scripts/pptx-to-pdf.mjs). Both land in
// public/slides/<slug>.pptx|.pdf; the PDF feeds the site's viewer and search.
//   npm run slides                 -> decks missing or older than their note
//   npm run slides -- <slug> ...   -> just these learnings
//   npm run slides -- --all        -> rebuild every deck
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { getLearnings, LEARNINGS_DIR, SLIDES_DIR, ROOT } from "../lib/content.mjs";
import { themeFor } from "../lib/themes.mjs";
import { pptxToPdf } from "./pptx-to-pdf.mjs";

const require = createRequire(import.meta.url);
const PptxGenJS = require("pptxgenjs");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa6");

// ---------------------------------------------------------------- geometry
const W = 13.333; // LAYOUT_WIDE
const M = 0.75; // side margin
const CW = W - 2 * M; // content width
const TOP = 2.05; // content area starts below the title
const BOTTOM = 6.65; // content area ends above the footer

// ---------------------------------------------------------------- icons
const ICONS = {
  book: Fa.FaBookOpen, idea: Fa.FaLightbulb, lightbulb: Fa.FaLightbulb, brain: Fa.FaBrain,
  graduation: Fa.FaGraduationCap, education: Fa.FaGraduationCap, chess: Fa.FaChessKnight,
  money: Fa.FaSackDollar, coins: Fa.FaCoins, chart: Fa.FaChartLine, growth: Fa.FaArrowTrendUp,
  shield: Fa.FaShieldHalved, rocket: Fa.FaRocket, target: Fa.FaBullseye, seedling: Fa.FaSeedling,
  key: Fa.FaKey, compass: Fa.FaCompass, clock: Fa.FaClock, people: Fa.FaUsers, heart: Fa.FaHeart,
  check: Fa.FaCheck, quote: Fa.FaQuoteLeft, flag: Fa.FaFlagCheckered, scale: Fa.FaScaleBalanced,
  handshake: Fa.FaHandshake, briefcase: Fa.FaBriefcase, mountain: Fa.FaMountain,
  puzzle: Fa.FaPuzzlePiece, fire: Fa.FaFire, list: Fa.FaListCheck, eye: Fa.FaEye,
};
const CATEGORY_ICON = { finance: "coins", startups: "rocket", "self-help": "seedling", psychology: "brain", productivity: "clock", business: "briefcase" };
const CONCEPT_ICONS = ["idea", "key", "compass", "target", "puzzle", "flag"];

const iconCache = new Map();
async function icon(name, hex) {
  const key = `${name}:${hex}`;
  if (!iconCache.has(key)) {
    const svg = renderToStaticMarkup(React.createElement(ICONS[name] || ICONS.idea, { color: `#${hex}`, size: 256 }));
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    iconCache.set(key, `image/png;base64,${png.toString("base64")}`);
  }
  return iconCache.get(key);
}

// Glowing dark background; pptx has no gradient fills, so it's an image.
async function darkBackground(t, variant) {
  const [gx, gy, ax, ay] = variant === "cover" ? [1500, 80, 120, 980] : [1450, 950, 150, 60];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <defs>
      <linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#${t.deep}"/><stop offset="0.8" stop-color="#07080C"/></linearGradient>
      <radialGradient id="g1" cx="${gx}" cy="${gy}" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#${t.mid}" stop-opacity="0.75"/><stop offset="1" stop-color="#${t.mid}" stop-opacity="0"/></radialGradient>
      <radialGradient id="g2" cx="${ax}" cy="${ay}" r="650" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#${t.accent}" stop-opacity="0.22"/><stop offset="1" stop-color="#${t.accent}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#base)"/><rect width="1600" height="900" fill="url(#g1)"/><rect width="1600" height="900" fill="url(#g2)"/>
  </svg>`;
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  return `image/jpeg;base64,${jpg.toString("base64")}`;
}

// ---------------------------------------------------------------- text helpers
const plain = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");

/** **bold** -> bold + emphasis colour, *italic* -> italic. Fresh option objects per run. */
function runs(text, base = {}, emph = {}) {
  return String(text)
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**")
        ? { text: part.slice(2, -2), options: { ...base, bold: true, ...emph } }
        : part.startsWith("*") && part.length > 2
          ? { text: part.slice(1, -1), options: { ...base, italic: true } }
          : { text: part, options: { ...base } },
    );
}

/** Largest font size (pt) at which `text` wraps into a w x h box (inches). */
function fit(text, w, h, max, min = 14, { bold = false, lineHeight = 1.2 } = {}) {
  const words = (para) => plain(para).split(/\s+/).filter(Boolean);
  for (let pt = max; pt > min; pt--) {
    const perLine = Math.floor(w / ((pt / 72) * (bold ? 0.56 : 0.5)));
    let lines = 0;
    for (const para of String(text).split("\n")) {
      let cur = 0;
      lines++;
      for (const word of words(para)) {
        if (cur && cur + 1 + word.length > perLine) {
          lines++;
          cur = word.length;
        } else cur += (cur ? 1 : 0) + word.length;
      }
    }
    if (lines * (pt / 72) * lineHeight <= h) return pt;
  }
  return min;
}

// Split into the fewest groups of at most `max`, keeping group sizes even.
const chunk = (arr, max) => {
  if (!arr.length) return [];
  const n = Math.ceil(arr.length / Math.ceil(arr.length / max));
  return Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
};
const pad = (n) => String(n).padStart(2, "0");
const hex = (c) => c.replace("#", "").toUpperCase();
const shadow = () => ({ type: "outer", color: "000000", opacity: 0.1, blur: 10, offset: 2, angle: 90 });

// ---------------------------------------------------------------- theme
function themeOf(l) {
  const t = themeFor(l.categorySlug);
  return {
    name: `Learning Hub ${t.name}`,
    headFontFace: "Arial",
    bodyFontFace: "Calibri",
    raw: { deep: hex(t.deep), mid: hex(t.mid), accent: hex(t.accent), soft: hex(t.soft) },
    colors: {
      dk1: "16181D", // body text on light slides
      lt1: "FFFFFF",
      dk2: hex(t.deep), // deep brand colour
      lt2: "F3F5F7", // card fill on light slides
      accent1: hex(t.mid), // main brand colour
      accent2: hex(t.accent), // bright highlight (dark slides)
      accent3: hex(t.soft), // soft tint
      accent4: "5B6170", // muted captions on light
      accent5: "A3ABBA", // muted captions on dark
      accent6: "0B0D12",
      hlink: hex(t.mid),
      folHlink: hex(t.deep),
    },
  };
}

/** pptxgenjs writes Office's palette; put the deck's own colours into the theme part. */
async function applyTheme(file, theme) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const part = "ppt/theme/theme1.xml";
  const slots = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
  const name = theme.name.replace(/[&<>"]/g, "");
  const scheme = `<a:clrScheme name="${name}">${slots.map((k) => `<a:${k}><a:srgbClr val="${theme.colors[k]}"/></a:${k}>`).join("")}</a:clrScheme>`;
  const xml = (await zip.file(part).async("string"))
    .replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
    .replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, (_, head) => `${head}${name}"`);
  zip.file(part, xml);
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

// ---------------------------------------------------------------- layouts
async function defineLayouts(pres, l, theme) {
  const C = pres.SchemeColor;
  const footer = `${l.book}${l.author ? ` · ${l.author}` : ""}`;
  const footerOpts = (dark) => ({ x: M, y: 6.95, w: 8, h: 0.3, margin: 0, fontSize: 10, color: dark ? C.accent5 : C.accent4 });
  const slideNumber = (dark) => ({ x: W - M - 1, y: 6.95, w: 1, h: 0.3, margin: 0, align: "right", fontSize: 10, color: dark ? theme.colors.accent5 : theme.colors.accent4 });

  pres.defineSlideMaster({
    title: "COVER",
    background: { data: await darkBackground(theme.raw, "cover") },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: M, y: 2.35, w: 7.9, h: 2.1, margin: 0, bold: true, color: C.background1, align: "left", valign: "bottom" }, text: "" } },
      { placeholder: { options: { name: "subtitle", type: "body", x: M, y: 4.65, w: 7.2, h: 1.0, margin: 0, fontSize: 20, color: C.accent3, valign: "top" }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "STATEMENT",
    background: { data: await darkBackground(theme.raw, "statement") },
    objects: [
      { placeholder: { options: { name: "kicker", type: "body", x: M + 1.15, y: 1.55, w: 9, h: 0.4, margin: 0, fontSize: 14, bold: true, charSpacing: 1, color: C.accent2, valign: "middle" }, text: "" } },
      { placeholder: { options: { name: "statement", type: "body", x: M, y: 2.35, w: 11.2, h: 3.9, margin: 0, bold: true, color: C.background1, valign: "top" }, text: "" } },
      { text: { text: footer, options: footerOpts(true) } },
    ],
    slideNumber: slideNumber(true),
  });
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { color: C.background1 },
    objects: [
      { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.55, w: CW, h: 0.32, margin: 0, fontSize: 13, bold: true, charSpacing: 1, color: C.accent1, valign: "top" }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: M, y: 0.9, w: CW, h: 0.85, margin: 0, fontSize: 34, bold: true, color: C.text1, align: "left", valign: "top" }, text: "" } },
      { text: { text: footer, options: footerOpts(false) } },
    ],
    slideNumber: slideNumber(false),
  });
}

// ---------------------------------------------------------------- slides
async function buildDeck(l, file) {
  const theme = themeOf(l);
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.theme = { headFontFace: theme.headFontFace, bodyFontFace: theme.bodyFontFace };
  pres.title = l.title;
  pres.subject = `${l.book} — ${l.category}`;
  pres.author = "Learning Hub";
  const C = pres.SchemeColor;
  const col = theme.colors;
  await defineLayouts(pres, l, theme);

  const iconCircle = async (slide, name, x, y, d, { fill = C.accent1, color = col.lt1, ratio = 0.5 } = {}) => {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" }, objectName: `icon-bg-${name}` });
    const s = d * ratio;
    slide.addImage({ data: await icon(name, color), x: x + (d - s) / 2, y: y + (d - s) / 2, w: s, h: s, altText: name, objectName: `icon-${name}` });
  };

  // 1. Cover -----------------------------------------------------------
  pres.addSection({ title: "Introduction" });
  {
    const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Introduction" });
    const cat = l.category.toUpperCase();
    const pillW = Math.max(1.3, cat.length * 0.13 + 0.6);
    s.addText(cat, {
      shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.2, x: M, y: 1.65, w: pillW, h: 0.42, fill: { color: C.accent2 },
      fontSize: 12, bold: true, charSpacing: 1, color: C.text2, align: "center", valign: "middle", margin: 0, objectName: "category",
    });
    s.addText(runs(l.title), { placeholder: "title", fontSize: fit(l.title, 7.9, 2.1, 54, 34, { bold: true, lineHeight: 1.1 }) });
    if (l.summary) s.addText(runs(l.summary), { placeholder: "subtitle", fontSize: fit(l.summary, 7.2, 1.0, 20, 14) });
    // Book card
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.85, w: 5.6, h: 0.95, rectRadius: 0.12, fill: { color: C.background1, transparency: 90 }, line: { color: C.background1, transparency: 75, width: 0.75 }, objectName: "book-card" });
    s.addImage({ data: await icon("book", col.accent2), x: M + 0.3, y: 6.1, w: 0.45, h: 0.45, altText: "Book", objectName: "book-icon" });
    s.addText(
      [
        { text: l.book, options: { bold: true, fontSize: 16, color: C.background1, breakLine: !!l.author } },
        ...(l.author ? [{ text: `by ${l.author}`, options: { fontSize: 13, color: C.accent5 } }] : []),
      ],
      { x: M + 0.95, y: 5.95, w: 4.5, h: 0.75, margin: 0, valign: "middle", isTextBox: true, objectName: "book-text" },
    );
    // Category emblem
    s.addShape(pres.shapes.OVAL, { x: 9.0, y: 1.9, w: 3.6, h: 3.6, fill: { color: C.accent2, transparency: 85 }, line: { color: C.accent2, transparency: 60, width: 1 }, objectName: "emblem-ring" });
    await iconCircle(s, CATEGORY_ICON[l.categorySlug] || "book", 9.75, 2.65, 2.1, { fill: C.accent2, color: col.dk2 });
    s.addNotes(plain(l.body.replace(/^#+\s*/gm, "")));
  }

  // 2. Big idea --------------------------------------------------------
  if (l.bigIdea) {
    const s = pres.addSlide({ masterName: "STATEMENT", sectionTitle: "Introduction" });
    await iconCircle(s, "idea", M, 1.4, 0.75, { fill: C.accent2, color: col.dk2 });
    s.addText("THE BIG IDEA", { placeholder: "kicker" });
    s.addText(runs(l.bigIdea, {}, { color: C.accent2 }), { placeholder: "statement", fontSize: fit(l.bigIdea, 11.2, 3.9, 44, 24, { bold: true, lineHeight: 1.15 }) });
  }

  // 3. At a glance -----------------------------------------------------
  const conceptIcon = (c, i) => (ICONS[c.icon] ? c.icon : CONCEPT_ICONS[i % CONCEPT_ICONS.length]);
  if (l.concepts.length >= 2) {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Introduction" });
    s.addText(`${l.concepts.length} IDEAS AT A GLANCE`, { placeholder: "kicker" });
    s.addText("The ideas in this learning", { placeholder: "title" });
    const n = l.concepts.length;
    const cols = n <= 4 ? n : 3;
    const rows = Math.ceil(n / cols);
    const gap = 0.3;
    const cw = (CW - gap * (cols - 1)) / cols;
    const ch = rows === 1 ? 3.9 : 2.1;
    for (const [i, c] of l.concepts.entries()) {
      const x = M + (i % cols) * (cw + gap);
      const y = TOP + 0.35 + Math.floor(i / cols) * (ch + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.15, fill: { color: C.background2 }, line: { type: "none" }, objectName: `card-${i + 1}` });
      if (rows === 1) {
        await iconCircle(s, conceptIcon(c, i), x + 0.35, y + 0.4, 0.95);
        s.addText(pad(i + 1), { x: x + 0.35, y: y + 1.6, w: cw - 0.7, h: 0.35, margin: 0, fontSize: 14, bold: true, color: C.accent1, isTextBox: true, objectName: `card-num-${i + 1}` });
        s.addText(runs(c.title), { x: x + 0.35, y: y + 2.0, w: cw - 0.7, h: 1.6, margin: 0, fontSize: fit(c.title, cw - 0.7, 1.6, 22, 15, { bold: true }), bold: true, color: C.text1, valign: "top", isTextBox: true, objectName: `card-title-${i + 1}` });
      } else {
        await iconCircle(s, conceptIcon(c, i), x + 0.3, y + 0.3, 0.8);
        s.addText(pad(i + 1), { x: x + 1.3, y: y + 0.3, w: cw - 1.6, h: 0.3, margin: 0, fontSize: 13, bold: true, color: C.accent1, isTextBox: true, objectName: `card-num-${i + 1}` });
        s.addText(runs(c.title), { x: x + 1.3, y: y + 0.65, w: cw - 1.6, h: ch - 0.95, margin: 0, fontSize: fit(c.title, cw - 1.6, ch - 0.95, 20, 14, { bold: true }), bold: true, color: C.text1, valign: "top", isTextBox: true, objectName: `card-title-${i + 1}` });
      }
    }
  }

  // 4. One slide per concept -------------------------------------------
  pres.addSection({ title: "Concepts" });
  for (const [i, c] of l.concepts.entries()) {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Concepts" });
    s.addText(`CONCEPT ${i + 1} OF ${l.concepts.length}`, { placeholder: "kicker" });
    s.addText(runs(c.title), { placeholder: "title" });
    const leftW = 6.7;
    s.addText(runs(c.explanation, {}, { color: C.accent1 }), {
      x: M, y: TOP + 0.2, w: leftW, h: 4.2, margin: 0, fontSize: fit(c.explanation, leftW, 4.2, 28, 16, { lineHeight: 1.35 }),
      color: C.text1, valign: "middle", lineSpacingMultiple: 1.15, isTextBox: true, objectName: "explanation",
    });
    const px = M + leftW + 0.6;
    const pw = W - M - px;
    if (c.example) {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px, y: TOP + 0.2, w: pw, h: 4.2, rectRadius: 0.15, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "example-card" });
      await iconCircle(s, conceptIcon(c, i), px + 0.4, TOP + 0.6, 0.85);
      s.addText("IN PRACTICE", { x: px + 0.4, y: TOP + 1.65, w: pw - 0.8, h: 0.3, margin: 0, fontSize: 12, bold: true, charSpacing: 1, color: C.accent1, isTextBox: true, objectName: "example-label" });
      s.addText(runs(c.example), { x: px + 0.4, y: TOP + 2.05, w: pw - 0.8, h: 2.15, margin: 0, fontSize: fit(c.example, pw - 0.8, 2.15, 20, 14), color: C.text2, valign: "top", isTextBox: true, objectName: "example-text" });
    } else {
      const d = 3.2;
      s.addShape(pres.shapes.OVAL, { x: px + (pw - d) / 2, y: TOP + 0.7, w: d, h: d, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "illustration-ring" });
      await iconCircle(s, conceptIcon(c, i), px + (pw - 1.9) / 2, TOP + 0.7 + (d - 1.9) / 2, 1.9);
    }
  }

  // 5. Takeaways -------------------------------------------------------
  pres.addSection({ title: "Takeaways and actions" });
  for (const [gi, group] of chunk(l.takeaways, 6).entries()) {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Takeaways and actions" });
    s.addText("KEY TAKEAWAYS", { placeholder: "kicker" });
    s.addText("What to remember", { placeholder: "title" });
    const n = group.length;
    const cols = n === 1 ? 1 : n === 3 || n >= 5 ? 3 : 2;
    const rows = Math.ceil(n / cols);
    const gap = 0.3;
    const cw = (CW - gap * (cols - 1)) / cols;
    const ch = Math.min(2.0, (BOTTOM - TOP - 0.3 - gap * (rows - 1)) / rows);
    for (const [i, t] of group.entries()) {
      const x = M + (i % cols) * (cw + gap);
      const y = TOP + 0.3 + Math.floor(i / cols) * (ch + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.15, fill: { color: C.background1 }, line: { color: C.background2, width: 1 }, shadow: shadow(), objectName: `takeaway-${i + 1}` });
      await iconCircle(s, "check", x + 0.3, y + 0.32, 0.6, { ratio: 0.45 });
      s.addText(runs(t, {}, { color: C.accent1 }), { x: x + 1.1, y: y + 0.3, w: cw - 1.4, h: ch - 0.6, margin: 0, fontSize: fit(t, cw - 1.4, ch - 0.6, 22, 14), color: C.text1, valign: "top", isTextBox: true, objectName: `takeaway-text-${i + 1}` });
    }
    if (gi === 0) s.addNotes(l.takeaways.map(plain).join("\n"));
  }

  // 6. Action plan -----------------------------------------------------
  let step = 0;
  for (const group of chunk(l.actions, 5)) {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Takeaways and actions" });
    s.addText("ACTION PLAN", { placeholder: "kicker" });
    s.addText("Put it into practice", { placeholder: "title" });
    const n = group.length;
    const cw = CW / n;
    const d = 0.85;
    const cy = TOP + 0.9;
    if (n > 1) s.addShape(pres.shapes.LINE, { x: M + cw / 2, y: cy + d / 2, w: cw * (n - 1), h: 0, line: { color: C.accent3, width: 3 }, objectName: "timeline" });
    for (const [i, a] of group.entries()) {
      const x = M + i * cw;
      s.addText(String(++step), {
        shape: pres.shapes.OVAL, x: x + (cw - d) / 2, y: cy, w: d, h: d, fill: { color: C.accent1 }, line: { color: C.background1, width: 4 },
        fontSize: 22, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, objectName: `step-${step}`,
      });
      s.addText(runs(a, {}, { color: C.accent1 }), {
        x: x + 0.15, y: cy + d + 0.35, w: cw - 0.3, h: 2.5, margin: 0, fontSize: fit(a, cw - 0.3, 2.5, 20, 14), color: C.text1,
        align: "center", valign: "top", isTextBox: true, objectName: `step-text-${step}`,
      });
    }
  }

  // 7. Quotes ----------------------------------------------------------
  pres.addSection({ title: "Close" });
  for (const group of chunk(l.quotes, 2)) {
    const s = pres.addSlide({ masterName: "STATEMENT", sectionTitle: "Close" });
    await iconCircle(s, "quote", M, 1.4, 0.75, { fill: C.accent2, color: col.dk2 });
    s.addText("WORTH QUOTING", { placeholder: "kicker" });
    const text = group.map((q) => `“${plain(q)}”`).join("\n");
    const size = fit(text, 11.2, 3.9, group.length === 1 ? 40 : 32, 20, { bold: true, lineHeight: 1.6 });
    s.addText(
      group.map((q, i) => ({ text: `“${plain(q)}”`, options: { italic: true, breakLine: i < group.length - 1, paraSpaceAfter: 18 } })),
      { placeholder: "statement", fontSize: size },
    );
  }

  // 8. Recap -----------------------------------------------------------
  {
    const s = pres.addSlide({ masterName: "STATEMENT", sectionTitle: "Close" });
    await iconCircle(s, "flag", M, 1.4, 0.75, { fill: C.accent2, color: col.dk2 });
    s.addText("IN ONE LINE", { placeholder: "kicker" });
    const line = l.summary || l.bigIdea || l.title;
    s.addText(runs(line, {}, { color: C.accent2 }), { placeholder: "statement", fontSize: fit(line, 11.2, 2.6, 40, 24, { bold: true, lineHeight: 1.15 }) });
    let x = M;
    for (const tag of l.tags.slice(0, 6)) {
      const w = tag.length * 0.11 + 0.55;
      s.addText(`#${tag}`, {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.18, x, y: 5.45, w, h: 0.42, fill: { color: C.background1, transparency: 88 },
        line: { color: C.background1, transparency: 70, width: 0.75 }, fontSize: 13, color: C.accent3, align: "center", valign: "middle", margin: 0, objectName: `tag-${tag}`,
      });
      x += w + 0.15;
    }
  }

  await pres.writeFile({ fileName: file });
  await applyTheme(file, theme);
}

// ---------------------------------------------------------------- main
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
  const decks = [];
  for (const l of learnings) {
    const file = path.join(SLIDES_DIR, `${l.slug}.pptx`);
    await buildDeck(l, file);
    decks.push(file);
    console.log(`slides: ${path.relative(ROOT, file)}`);
  }
  for (const pdf of pptxToPdf(decks)) console.log(`slides: ${path.relative(ROOT, pdf)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
