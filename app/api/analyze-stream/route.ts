import { runAgent, AGENT_KEYS, type AgentKey } from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const image = body?.image && body.image.data ? body.image : null;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      send({ type: "start", total: AGENT_KEYS.length, agents: AGENT_KEYS });
      AGENT_KEYS.forEach((key) => send({ type: "started", key }));

      let done = 0;
      const tasks = AGENT_KEYS.map(async (key: AgentKey) => {
        try {
          const result = await runAgent(key, image);
          done++;
          send({ type: "agent", key, body: result.body, progress: done / AGENT_KEYS.length });
        } catch (e: any) {
          done++;
          send({ type: "error", key, message: e?.message || "agent failed", progress: done / AGENT_KEYS.length });
        }
      });

      await Promise.all(tasks);
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
