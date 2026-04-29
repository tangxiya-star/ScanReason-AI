/**
 * TokenRouter integration.
 *
 * TokenRouter exposes an Anthropic-compatible /v1/messages endpoint at
 * https://api.tokenrouter.com. We point a second Anthropic SDK client at
 * that base URL and map each task class to a TokenRouter model id.
 *
 * If TokenRouter is unconfigured or any call fails (e.g. $0 credit, network),
 * we fall back to direct Anthropic so the demo never breaks.
 */

import Anthropic from "@anthropic-ai/sdk";
import { client as anthropicDirect, MODEL_FAST, MODEL_DEEP } from "./anthropic";

export type TaskClass = "vision" | "reason" | "draft" | "safety";

export type RouteRequest = {
  task: TaskClass;
  system: string;
  userContent: Anthropic.MessageParam["content"];
  maxTokens?: number;
  cacheSystem?: boolean;
};

export type RouteResponse = {
  text: string;
  modelUsed: string;
  router: "tokenrouter" | "anthropic-fallback";
};

const TR_KEY = process.env.TOKENROUTER_API_KEY;
const TR_BASE = process.env.TOKENROUTER_BASE_URL;

const trClient = TR_KEY && TR_BASE
  ? new Anthropic({ apiKey: TR_KEY, baseURL: TR_BASE })
  : null;

// Map our task classes to TokenRouter model ids. Vision-capable tasks need
// Claude (the Anthropic-compatible models support image blocks).
const TR_MODEL: Record<TaskClass, string> = {
  vision: "anthropic/claude-sonnet-4.6",
  reason: "anthropic/claude-sonnet-4.6",
  draft: "anthropic/claude-sonnet-4.6",
  safety: "anthropic/claude-opus-4.6",
};

// Same shape but for the direct-Anthropic fallback (uses real model ids).
const FALLBACK_MODEL: Record<TaskClass, string> = {
  vision: MODEL_FAST,
  reason: MODEL_FAST,
  draft: MODEL_FAST,
  safety: MODEL_DEEP,
};

export async function routeLLM(req: RouteRequest): Promise<RouteResponse> {
  if (trClient) {
    try {
      const resp = await trClient.messages.create({
        model: TR_MODEL[req.task],
        max_tokens: req.maxTokens ?? 1000,
        system: [
          {
            type: "text",
            text: req.system,
            ...(req.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}),
          },
        ],
        messages: [{ role: "user", content: req.userContent as any }],
      });
      const text = resp.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      return { text, modelUsed: TR_MODEL[req.task], router: "tokenrouter" };
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn(
        `[tokenrouter] ${req.task} failed (${msg.slice(0, 120)}) — falling back to direct Anthropic`
      );
      // fall through
    }
  }
  return anthropicFallback(req);
}

async function anthropicFallback(req: RouteRequest): Promise<RouteResponse> {
  const model = FALLBACK_MODEL[req.task];
  const resp = await anthropicDirect.messages.create({
    model,
    max_tokens: req.maxTokens ?? 1000,
    system: [
      {
        type: "text",
        text: req.system,
        ...(req.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}),
      },
    ],
    messages: [{ role: "user", content: req.userContent as any }],
  });
  const text = resp.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");
  return { text, modelUsed: model, router: "anthropic-fallback" };
}

export { MODEL_FAST, MODEL_DEEP };
