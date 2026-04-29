/**
 * Reboot sponsor integration point.
 *
 * Reboot ships as a **Claude Skill** (a markdown file with frontmatter), not an
 * HTTP API. The integration model is therefore: load the skill file at request
 * time and inject its body into the Explain Mode system prompt before calling
 * Claude.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * TO PLUG IN REBOOT:
 *   1. Drop the sponsor-provided skill file at:  skills/reboot/SKILL.md
 *   2. That's it. This module auto-detects it and prepends it to the prompt.
 *      No code changes needed.
 *
 * If SKILL.md is missing, Explain Mode falls back to a plain Claude prompt and
 * the app keeps working.
 * ──────────────────────────────────────────────────────────────────────────
 */

import fs from "node:fs";
import path from "node:path";
import { client, MODEL_DEEP, extractJSON, type ClientImage } from "./anthropic";
import type { ExplainPayload } from "./agents";

const SKILL_PATH = path.join(process.cwd(), "skills", "reboot", "SKILL.md");

let skillCache: { mtimeMs: number; body: string } | null = null;

function loadRebootSkill(): string | null {
  try {
    const stat = fs.statSync(SKILL_PATH);
    if (skillCache && skillCache.mtimeMs === stat.mtimeMs) return skillCache.body;
    const raw = fs.readFileSync(SKILL_PATH, "utf-8");
    // Strip YAML frontmatter if present
    const body = raw.replace(/^---[\s\S]*?---\s*/, "").trim();
    skillCache = { mtimeMs: stat.mtimeMs, body };
    return body;
  } catch {
    return null;
  }
}

export type RebootInput = {
  systemPrompt: string;
  caseBrief: string;
  instruction: string;
  image: ClientImage;
};

export type RebootResult = ExplainPayload & { provider: "reboot" | "anthropic-fallback" };

export async function rebootExplain(input: RebootInput): Promise<RebootResult> {
  const skill = loadRebootSkill();

  const system = skill
    ? [
        `${input.systemPrompt}\n\nCASE:\n${input.caseBrief}`,
        `\n\n──────────── REBOOT SKILL ────────────\n${skill}\n──────────── END SKILL ────────────`,
      ].join("")
    : `${input.systemPrompt}\n\nCASE:\n${input.caseBrief}`;

  const resp = await client.messages.create({
    model: MODEL_DEEP,
    max_tokens: 900,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.image.media as any,
              data: input.image.data,
            },
          },
          { type: "text", text: input.instruction },
        ],
      },
    ],
  });

  const text = resp.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");
  const parsed = extractJSON<ExplainPayload>(text);
  return { ...parsed, provider: skill ? "reboot" : "anthropic-fallback" };
}
