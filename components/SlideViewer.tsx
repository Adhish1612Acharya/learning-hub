"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { asset } from "@/lib/site";

// Renders a PDF deck with pdf.js so it works the same on every browser,
// including mobile ones that can't show PDFs inline. Opens on #slide=N.
export default function SlideViewer({ pdf, pptx, title }: { pdf: string; pptx?: string | null; title: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<any>(null);
  const renderRef = useRef<any>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = asset("/pdf.worker.min.mjs");
        const doc = await pdfjs.getDocument(asset(pdf)).promise;
        if (cancelled) return;
        docRef.current = doc;
        setPages(doc.numPages);
        const m = window.location.hash.match(/slide=(\d+)/);
        if (m) {
          setPage(Math.min(Math.max(1, Number(m[1])), doc.numPages));
          frameRef.current?.scrollIntoView({ block: "center" });
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  const draw = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    const p = await doc.getPage(page);
    const width = canvas.parentElement!.clientWidth;
    const base = p.getViewport({ scale: 1 });
    const viewport = p.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    renderRef.current?.cancel();
    const task = p.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport });
    renderRef.current = task;
    await task.promise.catch(() => {});
  }, [page]);

  useEffect(() => {
    if (pages) draw();
  }, [pages, draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
    };
  }, [draw]);

  const go = (d: number) => setPage((p) => Math.min(Math.max(1, p + d), pages || 1));

  if (error) {
    return (
      <a href={asset(pdf)} target="_blank" rel="noreferrer" className="block p-6 text-center underline">
        Open the slide deck (PDF)
      </a>
    );
  }

  return (
    <div
      ref={frameRef}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="slide-frame group relative bg-[#0b0d12] outline-none"
      aria-label={`${title} slides`}
    >
      <div className="slide-stage relative aspect-video w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
        {!pages && <div className="absolute inset-0 grid place-items-center text-sm text-white/60">Loading slides…</div>}
        <button type="button" aria-label="Previous slide" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/4" />
        <button type="button" aria-label="Next slide" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-1/4" />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-sm text-white/80">
        <div className="flex gap-1">
          <button type="button" onClick={() => go(-1)} disabled={page <= 1} className="rounded-md px-2.5 py-1 hover:bg-white/10 disabled:opacity-30">
            ←
          </button>
          <button type="button" onClick={() => go(1)} disabled={page >= pages} className="rounded-md px-2.5 py-1 hover:bg-white/10 disabled:opacity-30">
            →
          </button>
        </div>
        <span className="tabular-nums">
          {page} / {pages || "–"}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : frameRef.current?.requestFullscreen())}
            className="rounded-md px-2.5 py-1 hover:bg-white/10"
          >
            Full screen
          </button>
          <a href={asset(pdf)} download className="rounded-md px-2.5 py-1 hover:bg-white/10">
            PDF
          </a>
          {pptx && (
            <a href={asset(pptx)} download className="rounded-md px-2.5 py-1 hover:bg-white/10">
              PPTX
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
