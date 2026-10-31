// Converts PPTX decks to PDF with LibreOffice.
//   node scripts/pptx-to-pdf.mjs deck.pptx [more.pptx ...] [--outdir dir]
// The PDF lands next to each deck unless --outdir is given.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function sofficeBinary() {
  if (process.env.SOFFICE) return process.env.SOFFICE;
  const mac = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
  return fs.existsSync(mac) ? mac : "soffice";
}

/** Convert decks to PDF. Returns the PDF paths. */
export function pptxToPdf(files, outDir) {
  const groups = new Map();
  for (const f of files) {
    const dir = path.resolve(outDir || path.dirname(f));
    groups.set(dir, [...(groups.get(dir) || []), path.resolve(f)]);
  }
  const pdfs = [];
  for (const [dir, decks] of groups) {
    // A throwaway profile avoids clashing with a running LibreOffice and
    // works where the default profile can't be created.
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lo-profile-"));
    try {
      const res = spawnSync(
        sofficeBinary(),
        [`-env:UserInstallation=${pathToFileURL(profile).href}`, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, ...decks],
        { env: { ...process.env, SAL_USE_VCLPLUGIN: "svp" }, encoding: "utf8", timeout: 300_000 },
      );
      if (res.error) throw new Error(`LibreOffice failed to run: ${res.error.message}. Install LibreOffice or set SOFFICE.`);
      for (const deck of decks) {
        const pdf = path.join(dir, path.basename(deck).replace(/\.pptx$/i, ".pdf"));
        if (!fs.existsSync(pdf) || fs.statSync(pdf).mtimeMs < fs.statSync(deck).mtimeMs) {
          throw new Error(`LibreOffice did not convert ${deck}:\n${res.stderr || res.stdout}`);
        }
        pdfs.push(pdf);
      }
    } finally {
      fs.rmSync(profile, { recursive: true, force: true });
    }
  }
  return pdfs;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--outdir");
  const outDir = i >= 0 ? args.splice(i, 2)[1] : undefined;
  if (!args.length) {
    console.error("usage: node scripts/pptx-to-pdf.mjs deck.pptx [more.pptx ...] [--outdir dir]");
    process.exit(2);
  }
  try {
    for (const pdf of pptxToPdf(args, outDir)) console.log(`pdf: ${path.relative(process.cwd(), pdf)}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
