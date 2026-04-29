"use client";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { getCurrentImage } from "@/lib/imageBus";

type Explain = {
  whatWeSee: string;
  whyItMatters: string;
  whatToCompare: string;
  commonMistake: string;
  reportWording: string;
  provider?: "reboot" | "anthropic-fallback";
};

export default function ExplainModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Explain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null);
    setError(null);
    setLoading(true);
    const image = getCurrentImage();
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Explain failed");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const sections: { label: string; body: string; mono?: boolean }[] = data
    ? [
        { label: "What we see", body: data.whatWeSee },
        { label: "Why it matters", body: data.whyItMatters },
        { label: "What to compare", body: data.whatToCompare },
        { label: "Common mistake", body: data.commonMistake },
        { label: "Suggested report wording", body: data.reportWording, mono: true },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="glass glow-border w-full max-w-2xl rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-slate-900/60 to-transparent">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-mono text-cyan-300 flex items-center gap-2">
              <span>Explain Mode</span>
              {data?.provider === "reboot" && (
                <span className="px-1.5 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-300 text-[9px] tracking-[0.18em]">
                  REBOOT SKILL ACTIVE
                </span>
              )}
              {data?.provider === "anthropic-fallback" && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-500/15 border border-slate-400/30 text-slate-400 text-[9px] tracking-[0.18em]">
                  FALLBACK
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mt-0.5">Teaching read of current slice</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/10 transition" aria-label="Close">
            <X className="h-4 w-4 text-slate-300" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto thin-scrollbar">
          {loading && (
            <div className="text-[13px] text-slate-400 font-mono inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 pulse-dot" />
              Routing through Claude (deep reasoning)…
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-300">
              {error}
            </div>
          )}
          {sections.map((s) => (
            <div key={s.label}>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-cyan-300/80 mb-1.5">{s.label}</div>
              <p
                className={
                  s.mono
                    ? "text-[13px] leading-relaxed text-cyan-100 bg-slate-950/60 border border-cyan-400/20 rounded-lg p-3 font-mono"
                    : "text-[14px] leading-relaxed text-slate-300"
                }
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-white/5 bg-slate-950/40 text-[10px] text-slate-500 font-mono tracking-wider">
          Interactive explanation powered by Claude · Routed via TokenRouter
        </div>
      </div>
    </div>
  );
}
