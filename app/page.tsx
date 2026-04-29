"use client";
import { useState } from "react";
import MRIViewer from "@/components/MRIViewer";
import ReasoningPanel from "@/components/ReasoningPanel";
import ExplainModal from "@/components/ExplainModal";
import Spatial3DPanel from "@/components/Spatial3DPanel";
import { Activity } from "lucide-react";

export default function Page() {
  const [explainOpen, setExplainOpen] = useState(false);
  const [spatialOpen, setSpatialOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-white flex items-center justify-center shadow-[0_0_18px_rgba(56,189,248,0.45)]">
              <Activity className="h-4 w-4" />
              <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-slate-100">
                ScanReason <span className="text-gradient">AI</span>
              </div>
              <div className="text-[10px] text-slate-500 -mt-0.5 tracking-wider uppercase">
                Radiology reasoning copilot
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span className="hidden sm:inline">Case · Brain MRI · Adult</span>
            <span className="hidden sm:inline text-slate-700">|</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <span className="text-emerald-300/90">TokenRouter active</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1500px] w-full mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-100px)]">
          <div className="lg:col-span-7 h-full min-h-[520px]">
            <MRIViewer
              onExplain={() => setExplainOpen(true)}
              onReconstruct={() => setSpatialOpen(true)}
            />
          </div>
          <div className="lg:col-span-5 h-full min-h-[520px]">
            <ReasoningPanel onOpenSpatial={() => setSpatialOpen(true)} />
          </div>
        </div>
      </main>

      <ExplainModal open={explainOpen} onClose={() => setExplainOpen(false)} />
      <Spatial3DPanel open={spatialOpen} onClose={() => setSpatialOpen(false)} />
    </div>
  );
}
