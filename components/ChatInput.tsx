"use client";
import { ArrowUp } from "lucide-react";
import { useState } from "react";

type Props = { onSubmit: (q: string) => void };

const SUGGESTIONS: { label: string; text: string }[] = [
  { label: "Differential",   text: "Could this be small vessel ischemic disease instead of MS? What's your differential?" },
  { label: "McDonald 2017",  text: "Does this meet 2017 McDonald criteria? Is dissemination in space established?" },
  { label: "Next step",      text: "What's the highest-yield next investigation — post-contrast T1 or cervical spine MRI?" },
  { label: "Red flags",      text: "Are there any atypical features that should make me reconsider the MS diagnosis?" },
  { label: "Confidence",     text: "How confident are you in this read, and what would lower your confidence?" },
];

export default function ChatInput({ onSubmit }: Props) {
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!val.trim()) return;
        onSubmit(val.trim());
        setVal("");
      }}
      className="sticky bottom-0 bg-slate-950/70 backdrop-blur-xl border-t border-white/5 p-3"
    >
      {/* Suggestion chips — common junior-clinician questions */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              onSubmit(s.text);
              setVal("");
            }}
            title={s.text}
            className="text-[10px] font-mono tracking-wider uppercase px-2 py-1 rounded-md bg-white/[0.03] border border-white/10 text-slate-300 hover:text-cyan-200 hover:border-cyan-400/40 hover:bg-cyan-500/5 transition"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 focus-within:border-cyan-400/60 focus-within:ring-2 focus-within:ring-cyan-400/15 focus-within:shadow-[0_0_18px_-4px_rgba(56,189,248,0.5)] transition">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 pulse-dot shrink-0" />
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Ask why this matters, what to compare, or how to phrase the report..."
          className="flex-1 bg-transparent text-[13px] text-slate-100 outline-none placeholder:text-slate-500"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_14px_-2px_rgba(56,189,248,0.7)]"
          disabled={!val.trim()}
          aria-label="Send"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1.5 text-[10px] text-slate-500 text-center font-mono tracking-wider uppercase">
        Structured follow-up · not a chat
      </div>
    </form>
  );
}
