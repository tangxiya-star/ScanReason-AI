"use client";
import { useEffect, useRef, useState } from "react";
import AgentCard from "./AgentCard";
import ChatInput from "./ChatInput";
import { getCurrentImage } from "@/lib/imageBus";

type AgentKey = "observations" | "spatial" | "reasoning" | "checklist" | "safety";
type Status = "idle" | "running" | "done" | "error";

type Card = {
  key: AgentKey;
  title: string;
  body: string[];
  agent: string;
  accent?: "blue" | "slate" | "amber";
  status: Status;
  errorMsg?: string;
};

type FollowUp = { question: string; answer: string; agent: string };

const INITIAL: Card[] = [
  { key: "observations", title: "Observations", body: [], agent: "Observation Agent", status: "idle" },
  { key: "spatial", title: "Spatial Mapping", body: [], agent: "Spatial Mapping Agent", accent: "slate", status: "idle" },
  { key: "reasoning", title: "Clinical Reasoning", body: [], agent: "Reasoning Agent", status: "idle" },
  { key: "checklist", title: "What to Verify", body: [], agent: "Checklist Agent", status: "idle" },
  { key: "safety", title: "Uncertainty & Safety", body: [], agent: "Safety Agent", accent: "amber", status: "idle" },
];

export default function ReasoningPanel({ onOpenSpatial }: { onOpenSpatial: () => void }) {
  const [cards, setCards] = useState<Card[]>(INITIAL);
  const [progress, setProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateCard = (key: AgentKey, patch: Partial<Card>) =>
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const runAnalysis = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setAnalyzing(true);
    setError(null);
    setProgress(0);
    setCards((cs) => cs.map((c) => ({ ...c, body: [], status: "idle", errorMsg: undefined })));

    try {
      const image = getCurrentImage();
      const res = await fetch("/api/analyze-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error("Stream failed to open");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const events = buf.split("\n\n");
        buf = events.pop() || "";

        for (const ev of events) {
          const line = ev.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = JSON.parse(line.slice(5).trim());

          if (payload.type === "started") {
            updateCard(payload.key, { status: "running" });
          } else if (payload.type === "agent") {
            updateCard(payload.key, { status: "done", body: payload.body });
            setProgress(payload.progress ?? 0);
          } else if (payload.type === "error") {
            updateCard(payload.key, { status: "error", errorMsg: payload.message });
            setProgress(payload.progress ?? 0);
          } else if (payload.type === "done") {
            setProgress(1);
          }
        }
      }
      setHasRun(true);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    runAnalysis();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAsk = async (q: string) => {
    setAskLoading(true);
    try {
      const image = getCurrentImage();
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, image }),
      });
      const data = await res.json();
      setFollowUp(data);
    } finally {
      setAskLoading(false);
    }
  };

  const completedCount = cards.filter((c) => c.status === "done").length;

  return (
    <div className="glass glow-border h-full flex flex-col rounded-2xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(2,6,23,0.9)]">
      <div className="px-5 py-4 border-b border-white/5 bg-gradient-to-b from-slate-900/60 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100 tracking-tight">Reasoning Panel</h2>
              {analyzing && (
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 pulse-dot shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {analyzing
                ? `Routing through TokenRouter · ${completedCount}/${cards.length} agents`
                : "Multi-agent clinical reasoning · TokenRouter"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasRun && (
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="text-[11px] text-slate-400 hover:text-slate-100 font-medium disabled:opacity-40 transition"
              >
                Re-analyze
              </button>
            )}
            <button onClick={onOpenSpatial} className="text-[11px] text-cyan-300 hover:text-cyan-200 font-medium transition">
              View 3D →
            </button>
          </div>
        </div>

        <div className="mt-3 h-[3px] w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 shadow-[0_0_10px_rgba(56,189,248,0.7)] transition-[width] duration-500 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-300">
            {error}
            <button onClick={runAnalysis} className="ml-2 underline hover:text-red-200">Retry</button>
          </div>
        )}

        {cards.map((c) => (
          <AgentCard
            key={c.key}
            title={c.title}
            body={c.body}
            agent={c.agent}
            accent={c.accent || "blue"}
            status={c.status}
            errorMsg={c.errorMsg}
          />
        ))}

        {(followUp || askLoading) && (
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4 shadow-[0_0_30px_-12px_rgba(56,189,248,0.5)]">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-cyan-300 mb-1.5">Follow-up Response</div>
            {askLoading ? (
              <div className="text-[13px] text-slate-400 font-mono">Routing through reasoning agent…</div>
            ) : followUp ? (
              <>
                <div className="text-[12px] font-medium text-slate-200 mb-1">Q: {followUp.question}</div>
                <p className="text-[13px] text-slate-300 leading-relaxed">{followUp.answer}</p>
                <div className="mt-2 text-[10px] text-cyan-400/70 font-mono tracking-wider">
                  {followUp.agent} · Routed via TokenRouter
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      <ChatInput onSubmit={handleAsk} />
    </div>
  );
}
