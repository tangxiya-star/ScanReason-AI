"use client";
import { sampleCase, views, sliceUrl, type ViewKey } from "@/lib/mock";
import { Sparkles, Box, Crosshair, Loader2, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import BrainScene, { type LesionPoint } from "./BrainScene";
import { registerImageGetter, type ClientImage } from "@/lib/imageBus";

type Props = {
  onExplain: () => void;
  onReconstruct: () => void;
};

type SliceMeta = { idx: number; lesion: boolean; voxels?: number; cx?: number; cy?: number };
type ViewMeta = { count: number; axis: number; view: string; slices: SliceMeta[] };
type Cursor = { x: number; y: number; z: number }; // [0,1]^3 — x:L/R, y:A/P, z:S/I

const PANEL_DEFS: { key: ViewKey; short: string; full: string; axes: [string, string, string, string] }[] = [
  { key: "axial",    short: "AX",  full: "Axial",    axes: ["L", "R", "A", "P"] },
  { key: "coronal",  short: "COR", full: "Coronal",  axes: ["L", "R", "S", "I"] },
  { key: "sagittal", short: "SAG", full: "Sagittal", axes: ["A", "P", "S", "I"] },
];

// Mapping: which cursor axes drive each view's (sliceAxis, panelX, panelY)
type AxisKey = "x" | "y" | "z";
const AXIS_MAP: Record<ViewKey, { slice: AxisKey; px: AxisKey; py: AxisKey }> = {
  axial:    { slice: "z", px: "x", py: "y" },
  coronal:  { slice: "y", px: "x", py: "z" },
  sagittal: { slice: "x", px: "y", py: "z" },
};

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

function pickLesionAnchor(axialMeta: ViewMeta | null): Cursor {
  // Find the lesion-positive axial slice with the most voxels — anchor cursor there.
  if (!axialMeta) return { x: 0.5, y: 0.5, z: 0.5 };
  let best: SliceMeta | null = null;
  for (const s of axialMeta.slices) {
    if (!s.lesion) continue;
    if (!best || (s.voxels ?? 0) > (best.voxels ?? 0)) best = s;
  }
  if (!best) return { x: 0.5, y: 0.5, z: 0.5 };
  return {
    x: best.cx ?? 0.5,
    y: best.cy ?? 0.5,
    z: best.idx / Math.max(1, axialMeta.count - 1),
  };
}

export default function MRIViewer({ onExplain, onReconstruct }: Props) {
  const [metas, setMetas] = useState<Record<ViewKey, ViewMeta | null>>({
    axial: null, coronal: null, sagittal: null,
  });
  const [cursor, setCursor] = useState<Cursor>({ x: 0.5, y: 0.5, z: 0.5 });
  const [anchor, setAnchor] = useState<Cursor | null>(null);
  const [brainHeight, setBrainHeight] = useState(280);
  const [reconState, setReconState] = useState<"idle" | "loading" | "ready">("idle");
  const [reconProgress, setReconProgress] = useState(0);
  const [showVessels, setShowVessels] = useState(false);
  const [showNerves, setShowNerves] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMaximized(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  const startReconstruct = () => {
    if (reconState === "loading") return;
    if (reconState === "ready") { onReconstruct(); return; }
    setReconState("loading");
    setReconProgress(0);
    const start = performance.now();
    const dur = 2600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setReconProgress(t);
      if (t < 1) requestAnimationFrame(tick);
      else setReconState("ready");
    };
    requestAnimationFrame(tick);
  };
  const resizeStateRef = useRef<{ startY: number; startH: number } | null>(null);

  const onResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeStateRef.current = { startY: e.clientY, startH: brainHeight };
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = resizeStateRef.current;
    if (!s) return;
    const next = Math.max(160, Math.min(720, s.startH + (e.clientY - s.startY)));
    setBrainHeight(next);
  };
  const onResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    resizeStateRef.current = null;
  };

  // Load all three meta.json once
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      (["axial", "coronal", "sagittal"] as ViewKey[]).map((v) =>
        fetch(`/slices/${v}/meta.json`).then((r) => r.json()).then((m: ViewMeta) => [v, m] as const).catch(() => [v, null] as const)
      )
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<ViewKey, ViewMeta | null> = { axial: null, coronal: null, sagittal: null };
      for (const [v, m] of entries) next[v] = m;
      setMetas(next);
      const a = pickLesionAnchor(next.axial);
      setAnchor(a);
      setCursor(a);
    });
    return () => { cancelled = true; };
  }, []);

  // Keep the axial slice at the current cursor available as base64 for the
  // reasoning API. Refreshes whenever the user scrubs through axial slices.
  const imageRef = useRef<ClientImage | null>(null);
  useEffect(() => {
    const axialIdx = Math.round(clamp01(cursor.z) * (views.axial.count - 1));
    let cancelled = false;
    fetch(sliceUrl("axial", axialIdx))
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = () => reject(fr.error);
            fr.readAsDataURL(blob);
          })
      )
      .then((dataUrl) => {
        if (cancelled) return;
        const comma = dataUrl.indexOf(",");
        if (comma < 0) return;
        imageRef.current = { media: "image/jpeg", data: dataUrl.slice(comma + 1) };
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cursor.z]);

  useEffect(() => {
    registerImageGetter(() => imageRef.current);
    return () => registerImageGetter(null);
  }, []);

  const lesionTotal = useMemo(() => {
    const a = metas.axial?.slices.filter((s) => s.lesion).length ?? 0;
    const c = metas.coronal?.slices.filter((s) => s.lesion).length ?? 0;
    const s = metas.sagittal?.slices.filter((s) => s.lesion).length ?? 0;
    return a + c + s;
  }, [metas]);

  // Map per-slice lesion centroids (axial → 3D scatter for the brain mesh)
  const lesions3D = useMemo<LesionPoint[]>(() => {
    const a = metas.axial;
    if (!a) return [];
    const maxVox = a.slices.reduce((m, s) => Math.max(m, s.voxels ?? 0), 1);
    return a.slices
      .filter((s) => s.lesion && s.cx != null && s.cy != null)
      .map((s) => ({
        x: s.cx!,
        y: s.cy!,
        z: s.idx / Math.max(1, a.count - 1),
        size: Math.min(1, (s.voxels ?? 1) / maxVox),
      }));
  }, [metas]);

  return (
    <div className="glass glow-border h-full flex flex-col rounded-2xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(2,6,23,0.9)]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-gradient-to-b from-slate-900/60 to-transparent">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80 font-mono">
            Patient {sampleCase.patientId}
          </div>
          <div className="text-sm font-semibold text-slate-100 mt-0.5">{sampleCase.modality}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-slate-400 font-mono">
            MNI <span className="text-cyan-300">{(cursor.x * 2 - 1).toFixed(2)}</span>
            <span className="text-slate-600">, </span>
            <span className="text-cyan-300">{(cursor.y * 2 - 1).toFixed(2)}</span>
            <span className="text-slate-600">, </span>
            <span className="text-cyan-300">{(cursor.z * 2 - 1).toFixed(2)}</span>
          </div>
          <button
            onClick={() => anchor && setCursor(anchor)}
            disabled={!anchor}
            className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-400/30 hover:bg-fuchsia-500/20 disabled:opacity-30 transition inline-flex items-center gap-1.5"
          >
            <Crosshair className="h-3 w-3" />
            Reset to lesion
          </button>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            Live
          </span>
        </div>
      </div>

      {/* Three synchronized 2D panels */}
      <div className="grid grid-cols-3 gap-2 p-2 bg-slate-950/60 border-b border-white/5">
        {PANEL_DEFS.map((def) => (
          <Pane
            key={def.key}
            def={def}
            cursor={cursor}
            onCursor={setCursor}
            meta={metas[def.key]}
          />
        ))}
      </div>

      {/* Inline 3D volumetric view (idle / loading / ready) */}
      <div
        className="relative border-b border-white/5 bg-black"
        style={{ height: reconState === "idle" ? 140 : brainHeight }}
      >
        {reconState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,#0b1220_0%,#000_75%)]">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">3D Volumetric Reconstruction</div>
            <button
              onClick={startReconstruct}
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-medium shadow-[0_0_22px_-4px_rgba(56,189,248,0.7)] hover:shadow-[0_0_30px_-2px_rgba(56,189,248,0.9)] transition"
            >
              <Box className="h-4 w-4" />
              Reconstruct in 3D
            </button>
            <div className="text-[10px] font-mono text-slate-600 tracking-wider">
              {lesionTotal} lesion slices · est. ~3s
            </div>
          </div>
        )}

        {reconState === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_center,#0b1220_0%,#000_80%)] overflow-hidden">
            {/* Animated scan rings */}
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-cyan-300/60 animate-ping [animation-delay:0.3s]" />
              <div className="absolute inset-4 rounded-full border border-cyan-200/80 animate-ping [animation-delay:0.6s]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Box className="h-8 w-8 text-cyan-300 animate-pulse" />
              </div>
            </div>
            <div className="text-[11px] font-mono tracking-wider text-cyan-300">
              {reconProgress < 0.25 && "Loading volumetric mesh…"}
              {reconProgress >= 0.25 && reconProgress < 0.55 && "Aligning to MNI space…"}
              {reconProgress >= 0.55 && reconProgress < 0.85 && "Computing X-ray shading…"}
              {reconProgress >= 0.85 && "Finalizing reconstruction…"}
            </div>
            <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(56,189,248,0.7)] transition-[width] duration-100 ease-linear"
                style={{ width: `${Math.round(reconProgress * 100)}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-slate-500 tracking-wider">{Math.round(reconProgress * 100)}%</div>
          </div>
        )}

        {reconState === "ready" && (
          <>
            <BrainScene cursor={cursor} lesions={lesions3D} showVessels={showVessels} showNerves={showNerves} />

            {/* Layer toggles — single click ON, double click OFF */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
              <LayerButton
                label="Vessels"
                active={showVessels}
                color="#ef4444"
                onToggle={() => setShowVessels((v) => !v)}
              />
              <LayerButton
                label="Nerves"
                active={showNerves}
                color="#facc15"
                onToggle={() => setShowNerves((v) => !v)}
              />
            </div>
            <div className="absolute bottom-2 left-3 text-[10px] font-mono text-slate-500 tracking-wider pointer-events-none">
              ROI mirrors 2D crosshair · drag to orbit
            </div>
            <button
              onClick={() => setMaximized(true)}
              title="Maximize"
              className="absolute top-2 right-10 h-6 w-6 rounded-md bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 backdrop-blur-sm flex items-center justify-center text-slate-300 hover:text-cyan-300 transition"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1 4V1H4M11 4V1H8M1 8V11H4M11 8V11H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={startReconstruct}
              title="Hide 3D view"
              className="absolute top-2 right-2 h-6 w-6 rounded-md bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 backdrop-blur-sm flex items-center justify-center text-slate-300 hover:text-cyan-300 transition text-[14px] leading-none"
            >
              ×
            </button>
            <div
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              onPointerCancel={onResizeUp}
              title="Drag to resize"
              className="absolute bottom-1.5 right-1.5 h-6 w-6 rounded-md bg-slate-900/80 border border-cyan-400/40 hover:border-cyan-300 hover:bg-slate-800/80 backdrop-blur-sm flex items-center justify-center cursor-ns-resize text-cyan-300 select-none touch-none shadow-[0_0_10px_-2px_rgba(56,189,248,0.6)]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="absolute bottom-2 right-9 text-[9px] font-mono text-slate-500 tracking-wider pointer-events-none">
              {brainHeight}px
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 py-3 border-t border-white/5 bg-gradient-to-t from-slate-900/60 to-transparent">
        <button
          onClick={onExplain}
          className="group relative inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white transition shadow-[0_0_22px_-4px_rgba(56,189,248,0.7)] hover:shadow-[0_0_28px_-2px_rgba(56,189,248,0.9)]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Explain this finding
          <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" />
        </button>
        <button
          onClick={startReconstruct}
          disabled={reconState === "loading"}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-100 border border-white/10 hover:border-cyan-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Box className="h-3.5 w-3.5" />
          {reconState === "idle" && "Reconstruct in 3D"}
          {reconState === "loading" && `Reconstructing… ${Math.round(reconProgress * 100)}%`}
          {reconState === "ready" && "Hide 3D"}
        </button>
        <div className="ml-auto text-[11px] text-slate-500 font-mono">
          Lesions: <span className="text-fuchsia-300">{lesionTotal}</span>
          <span className="text-slate-600 mx-2">·</span>
          Confidence: <span className="text-amber-300">{sampleCase.confidence}</span>
        </div>
      </div>

      {maximized && reconState === "ready" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass glow-border w-full h-full max-w-7xl max-h-[92vh] rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-slate-900/60 to-transparent">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-mono text-cyan-300">3D Volumetric · Expanded</div>
                <h3 className="text-base font-semibold text-slate-100 mt-0.5">{sampleCase.modality}</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[11px] text-slate-400 font-mono">
                  MNI <span className="text-cyan-300">{(cursor.x * 2 - 1).toFixed(2)}</span>
                  <span className="text-slate-600">, </span>
                  <span className="text-cyan-300">{(cursor.y * 2 - 1).toFixed(2)}</span>
                  <span className="text-slate-600">, </span>
                  <span className="text-cyan-300">{(cursor.z * 2 - 1).toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setMaximized(false)}
                  title="Close (Esc)"
                  className="p-2 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/10 transition text-slate-300"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="relative flex-1 bg-black">
              <BrainScene cursor={cursor} lesions={lesions3D} showVessels={showVessels} showNerves={showNerves} />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
                <LayerButton label="Vessels" active={showVessels} color="#ef4444" onToggle={() => setShowVessels((v) => !v)} />
                <LayerButton label="Nerves"  active={showNerves}  color="#facc15" onToggle={() => setShowNerves((v) => !v)} />
              </div>
              <div className="absolute bottom-3 left-4 text-[10px] font-mono text-slate-500 tracking-wider pointer-events-none">
                Press Esc to close · scroll to zoom · drag to orbit
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pane({
  def,
  cursor,
  onCursor,
  meta,
}: {
  def: typeof PANEL_DEFS[number];
  cursor: Cursor;
  onCursor: (c: Cursor) => void;
  meta: ViewMeta | null;
}) {
  const map = AXIS_MAP[def.key];
  const count = views[def.key].count;
  const sliceIdx = Math.round(clamp01(cursor[map.slice]) * (count - 1));
  const px = clamp01(cursor[map.px]);
  const py = clamp01(cursor[map.py]);
  const sliceMeta = meta?.slices[sliceIdx];

  const updateAxis = (axis: AxisKey, value: number) => {
    onCursor({ ...cursor, [axis]: clamp01(value) });
  };

  const updateFromPointer = (clientX: number, clientY: number, rect: DOMRect) => {
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    onCursor({
      ...cursor,
      [map.px]: clamp01(nx),
      [map.py]: clamp01(ny),
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY, target.getBoundingClientRect());
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return; // only while primary button held
    updateFromPointer(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const step = 1 / Math.max(1, count - 1);
    const delta = e.deltaY > 0 ? step : -step;
    updateAxis(map.slice, cursor[map.slice] + delta);
  };

  return (
    <div className="relative bg-black overflow-hidden border border-cyan-400/20 rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_24px_-12px_rgba(56,189,248,0.4)] aspect-square">
      {/* Header strip */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 py-1.5 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="text-[10px] font-mono tracking-widest">
          <span className="text-cyan-300">{def.short}</span>
          <span className="text-slate-500"> · </span>
          <span className="text-slate-300">{sliceIdx + 1}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-500">{count}</span>
        </div>
        {sliceMeta?.lesion && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-400/30 rounded px-1.5 py-0.5">
            ● Lesion
          </span>
        )}
      </div>

      {/* Image surface */}
      <div
        className="absolute inset-0 cursor-crosshair select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sliceUrl(def.key, sliceIdx)}
          alt={`${def.full} slice ${sliceIdx + 1}`}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ filter: "contrast(1.05) brightness(0.95)" }}
          draggable={false}
        />

        {/* Crosshair — horizontal line (with center gap) */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: `${py * 100}%`,
            left: 0, right: 0, height: 1,
            transform: "translateY(-0.5px)",
            background:
              `linear-gradient(to right,
                rgba(248,113,113,0.85) 0%,
                rgba(248,113,113,0.85) calc(${px * 100}% - 8px),
                transparent calc(${px * 100}% - 8px),
                transparent calc(${px * 100}% + 8px),
                rgba(248,113,113,0.85) calc(${px * 100}% + 8px),
                rgba(248,113,113,0.85) 100%)`,
            boxShadow: "0 0 4px rgba(248,113,113,0.5)",
          }}
        />
        {/* Crosshair — vertical line (with center gap) */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${px * 100}%`,
            top: 0, bottom: 0, width: 1,
            transform: "translateX(-0.5px)",
            background:
              `linear-gradient(to bottom,
                rgba(248,113,113,0.85) 0%,
                rgba(248,113,113,0.85) calc(${py * 100}% - 8px),
                transparent calc(${py * 100}% - 8px),
                transparent calc(${py * 100}% + 8px),
                rgba(248,113,113,0.85) calc(${py * 100}% + 8px),
                rgba(248,113,113,0.85) 100%)`,
            boxShadow: "0 0 4px rgba(248,113,113,0.5)",
          }}
        />
        {/* Center dot */}
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            left: `${px * 100}%`,
            top: `${py * 100}%`,
            width: 5, height: 5,
            transform: "translate(-50%, -50%)",
            background: "#fca5a5",
            boxShadow: "0 0 6px rgba(248,113,113,0.9), 0 0 0 1px rgba(127,29,29,0.9)",
          }}
        />
      </div>

      {/* Orientation labels */}
      <div className="absolute top-1/2 left-1.5 -translate-y-1/2 text-[10px] text-cyan-400/60 font-mono pointer-events-none">{def.axes[0]}</div>
      <div className="absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] text-cyan-400/60 font-mono pointer-events-none">{def.axes[1]}</div>
      <div className="absolute top-7 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 font-mono pointer-events-none">{def.axes[2]}</div>
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 font-mono pointer-events-none">{def.axes[3]}</div>

      {/* Per-pane slice scrubber with lesion ticks */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-2 py-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <div className="relative h-3 flex items-center">
          <input
            type="range"
            min={0}
            max={count - 1}
            value={sliceIdx}
            onChange={(e) => updateAxis(map.slice, parseInt(e.target.value, 10) / Math.max(1, count - 1))}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-full accent-cyan-400 relative z-10"
            aria-label={`${def.full} slice`}
          />
          {/* Lesion tick overlay */}
          {meta && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 pointer-events-none">
              {meta.slices.map((s) =>
                s.lesion ? (
                  <span
                    key={s.idx}
                    className="absolute top-0 h-full w-[2px] bg-fuchsia-400/80 rounded-full"
                    style={{ left: `${(s.idx / Math.max(1, count - 1)) * 100}%` }}
                  />
                ) : null
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LayerButton({
  label, active, color, onToggle,
}: {
  label: string;
  active: boolean;
  color: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={`Toggle ${label}`}
      className={
        "group relative px-2.5 py-1.5 rounded-md backdrop-blur-md text-[10px] font-mono uppercase tracking-wider border transition select-none flex items-center gap-1.5 " +
        (active
          ? "bg-slate-900/80 border-white/20 text-white shadow-[0_0_14px_-2px_var(--c)]"
          : "bg-slate-950/60 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20")
      }
      style={{ ["--c" as never]: color } as React.CSSProperties}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{
          background: active ? color : "transparent",
          border: `1px solid ${color}`,
          boxShadow: active ? `0 0 8px ${color}` : undefined,
        }}
      />
      {label}
    </button>
  );
}
