import { cn } from "@/lib/utils";

type Status = "idle" | "running" | "done" | "error";

type Props = {
  title: string;
  body: string[];
  agent: string;
  accent?: "blue" | "slate" | "amber";
  status?: Status;
  errorMsg?: string;
};

const accentBar: Record<string, string> = {
  blue: "from-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(56,189,248,0.6)]",
  slate: "from-slate-400 to-slate-500 shadow-[0_0_8px_rgba(148,163,184,0.4)]",
  amber: "from-amber-300 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,0.5)]",
};
const accentText: Record<string, string> = {
  blue: "text-cyan-300",
  slate: "text-slate-300",
  amber: "text-amber-300",
};
const accentDot: Record<string, string> = {
  blue: "bg-cyan-400",
  slate: "bg-slate-400",
  amber: "bg-amber-400",
};

function StatusBadge({ status, accent }: { status: Status; accent: string }) {
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-300">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 pulse-dot shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
        Thinking
      </span>
    );
  if (status === "error")
    return (
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-red-300">Error</span>
    );
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        Done
      </span>
    );
  return (
    <span className={cn("text-[10px] uppercase tracking-[0.18em] font-mono", accentText[accent])}>
      Agent
    </span>
  );
}

export default function AgentCard({
  title,
  body,
  agent,
  accent = "blue",
  status = "idle",
  errorMsg,
}: Props) {
  const isRunning = status === "running";
  const isIdle = status === "idle";
  return (
    <div
      className={cn(
        "relative rounded-xl glass p-4 pl-5 transition hover:border-white/20 overflow-hidden",
        "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-r before:bg-gradient-to-b",
        accentBar[accent],
        isRunning && "shadow-[0_0_24px_-8px_rgba(56,189,248,0.5)]"
      )}
    >
      {isRunning && (
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, rgba(56,189,248,0.10) 50%, transparent 70%)",
            backgroundSize: "200% 100%",
            animation: "agentShimmer 1.6s linear infinite",
          }}
        />
      )}

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h3>
          <StatusBadge status={status} accent={accent} />
        </div>

        {body.length > 0 ? (
          <ul className="space-y-1.5">
            {body.map((line, i) => (
              <li
                key={i}
                className="text-[13px] leading-relaxed text-slate-300 flex gap-2"
                style={{ animation: "agentFadeIn 350ms ease-out both", animationDelay: `${i * 60}ms` }}
              >
                <span className={cn("mt-2 h-1 w-1 rounded-full shrink-0", accentDot[accent])} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : status === "error" ? (
          <div className="text-[12px] text-red-300/90 leading-relaxed">{errorMsg || "Failed."}</div>
        ) : (
          <ul className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-2 items-center">
                <span className={cn("h-1 w-1 rounded-full shrink-0", accentDot[accent], isIdle && "opacity-40")} />
                <span
                  className="h-2 rounded bg-white/10 flex-1"
                  style={{
                    width: `${[80, 65, 72][i]}%`,
                    opacity: isRunning ? 0.55 : 0.25,
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-slate-500 font-mono tracking-wider">
          {agent} <span className="text-slate-700">·</span> Routed via TokenRouter
        </div>
      </div>
    </div>
  );
}
