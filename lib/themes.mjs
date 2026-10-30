// Colour theme per category, used by the website and the slide decks.
const THEMES = {
  finance: { name: "emerald", deep: "#022c22", mid: "#047857", accent: "#34d399", soft: "#d1fae5" },
  startups: { name: "violet", deep: "#1e0b3b", mid: "#4f46e5", accent: "#a78bfa", soft: "#ede9fe" },
  "self-help": { name: "amber", deep: "#2a1203", mid: "#c2410c", accent: "#fbbf24", soft: "#fef3c7" },
  psychology: { name: "rose", deep: "#2a0614", mid: "#be123c", accent: "#fb7185", soft: "#ffe4e6" },
  productivity: { name: "sky", deep: "#04213a", mid: "#0369a1", accent: "#38bdf8", soft: "#e0f2fe" },
  business: { name: "indigo", deep: "#0d1238", mid: "#3730a3", accent: "#818cf8", soft: "#e0e7ff" },
};
const FALLBACK = [
  { name: "teal", deep: "#042f2e", mid: "#0f766e", accent: "#2dd4bf", soft: "#ccfbf1" },
  { name: "fuchsia", deep: "#2a0430", mid: "#a21caf", accent: "#e879f9", soft: "#fae8ff" },
  { name: "lime", deep: "#132003", mid: "#4d7c0f", accent: "#a3e635", soft: "#ecfccb" },
];

export function themeFor(categorySlug) {
  if (THEMES[categorySlug]) return THEMES[categorySlug];
  let h = 0;
  for (const ch of String(categorySlug)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
