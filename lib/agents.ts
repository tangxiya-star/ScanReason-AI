import type Anthropic from "@anthropic-ai/sdk";
import {
  loadMRIImage,
  CASE_BRIEF,
  SYSTEM_BASE,
  extractJSON,
  type ClientImage,
} from "./anthropic";
import { routeLLM } from "./tokenrouter";
import { rebootExplain } from "./reboot";

type ImageBlock = Anthropic.Messages.ImageBlockParam;
type Base64Media = Anthropic.Messages.Base64ImageSource["media_type"];

function imageBlock(override?: ClientImage | null): ImageBlock {
  const img = loadMRIImage(override);
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: img.media as Base64Media,
      data: img.data,
    },
  };
}

function caseBrief(override?: ClientImage | null) {
  if (override) {
    return `${CASE_BRIEF}\n\nNOTE: The image below is the slice the reader is currently viewing (one of axial/coronal/sagittal). Analyze only this slice. If the slice has no cyan-tinted regions, treat it as unremarkable for this read and say so.`;
  }
  return CASE_BRIEF;
}

const ANALYZE_INSTRUCTION = `You are running FIVE specialist agents in parallel over the highlighted MRI.

Return a single JSON object with this exact shape:
{
  "observations": { "body": [string, string, string] },
  "spatial":      { "body": [string, string, string] },
  "reasoning":    { "body": [string, string, string] },
  "checklist":    { "body": [string, string, string, string] },
  "safety":       { "body": [string, string, string] }
}

Agent guidance:
- observations: purely descriptive imaging findings (signal, symmetry, mass effect, restricted diffusion if inferable).
- spatial: anatomic localization, neighboring structures involved, laterality, slice-range context.
- reasoning: differential diagnosis ranked by likelihood with one-line justification each. Include do-not-miss diagnoses.
- checklist: concrete next imaging or clinical steps the junior clinician should verify (priors, sequences, labs, exam).
- safety: confidence statement, do-not-miss flags, and explicit recommendation to seek senior/neuro-radiology read.

Each bullet ≤ 22 words. No emoji. No headings. Plain clinical prose.`;

export type AnalyzePayload = {
  observations: { body: string[] };
  spatial: { body: string[] };
  reasoning: { body: string[] };
  checklist: { body: string[] };
  safety: { body: string[] };
};

export async function analyzeCase(image?: ClientImage | null): Promise<AnalyzePayload> {
  const { text } = await routeLLM({
    task: "vision",
    system: `${SYSTEM_BASE}\n\nCASE:\n${caseBrief(image)}`,
    userContent: [imageBlock(image), { type: "text", text: ANALYZE_INSTRUCTION }],
    maxTokens: 1400,
    cacheSystem: true,
  });
  return extractJSON<AnalyzePayload>(text);
}

// ── Per-agent runners (used by the streaming endpoint) ──────────────────

export type AgentKey = "observations" | "spatial" | "reasoning" | "checklist" | "safety";

const AGENT_DEFS: Record<
  AgentKey,
  { role: string; bullets: number; task: "vision" | "reason" | "safety" }
> = {
  observations: {
    role: "Observation Agent. Describe the highlighted MRI region purely in imaging terms — signal, symmetry, mass effect, swelling, restricted diffusion if inferable. No diagnosis.",
    bullets: 3,
    task: "vision",
  },
  spatial: {
    role: "Spatial Mapping Agent. Localize the finding anatomically. Describe laterality, neighboring structures involved, slice-range context.",
    bullets: 3,
    task: "vision",
  },
  reasoning: {
    role: "Clinical Reasoning Agent. Provide a ranked differential diagnosis with one-line justifications. Include do-not-miss diagnoses.",
    bullets: 3,
    task: "reason",
  },
  checklist: {
    role: "Checklist Agent. Concrete next imaging or clinical steps the junior clinician should verify (priors, additional sequences, labs, exam findings).",
    bullets: 4,
    task: "reason",
  },
  safety: {
    role: "Safety Agent. Confidence statement, do-not-miss flags, and explicit recommendation to seek senior or neuro-radiology read.",
    bullets: 3,
    task: "safety",
  },
};

export async function runAgent(
  key: AgentKey,
  image?: ClientImage | null
): Promise<{ key: AgentKey; body: string[] }> {
  const def = AGENT_DEFS[key];
  const instruction = `${def.role}

Return ONLY a valid JSON object: { "body": [${Array(def.bullets).fill("string").join(", ")}] }
Each bullet ≤ 22 words. No emoji, no headings, plain clinical prose.`;
  const { text } = await routeLLM({
    task: def.task,
    system: `${SYSTEM_BASE}\n\nCASE:\n${caseBrief(image)}`,
    userContent: [imageBlock(image), { type: "text", text: instruction }],
    maxTokens: 500,
    cacheSystem: true,
  });
  const parsed = extractJSON<{ body: string[] }>(text);
  return { key, body: parsed.body };
}

export const AGENT_KEYS: AgentKey[] = [
  "observations",
  "spatial",
  "reasoning",
  "checklist",
  "safety",
];

const EXPLAIN_INSTRUCTION = `You are the Explain Agent in teaching mode for a junior clinician viewing the highlighted MRI.

Return a single JSON object:
{
  "whatWeSee": string,
  "whyItMatters": string,
  "whatToCompare": string,
  "commonMistake": string,
  "reportWording": string
}

- whatWeSee (1–2 sentences): describe the imaging finding plainly.
- whyItMatters (1–2 sentences): clinical significance, including any do-not-miss diagnoses.
- whatToCompare (1–2 sentences): contralateral side, prior imaging, additional sequences.
- commonMistake (1 sentence): a typical error a junior reader makes here.
- reportWording (2–3 sentences): a clean, hedged paragraph suitable to paste into a radiology report's findings/impression.

Plain clinical prose. No markdown.`;

export type ExplainPayload = {
  whatWeSee: string;
  whyItMatters: string;
  whatToCompare: string;
  commonMistake: string;
  reportWording: string;
};

export async function explainCase(
  image?: ClientImage | null
): Promise<ExplainPayload & { provider: "reboot" | "anthropic-fallback" }> {
  const img = loadMRIImage(image);
  return rebootExplain({
    systemPrompt: SYSTEM_BASE,
    caseBrief: caseBrief(image),
    instruction: EXPLAIN_INSTRUCTION,
    image: img,
  });
}

export type FollowUpPayload = { question: string; answer: string; agent: string };

export async function followUp(question: string, image?: ClientImage | null): Promise<FollowUpPayload> {
  const { text } = await routeLLM({
    task: "reason",
    system: `${SYSTEM_BASE}\n\nCASE:\n${caseBrief(image)}\n\nROLE: You are the Follow-up Reasoning Agent. The junior clinician is asking a targeted question about this case. Answer in 2–4 sentences, clinically grounded, hedged appropriately. Return JSON: { "answer": string }.`,
    userContent: [imageBlock(image), { type: "text", text: `Question: ${question}` }],
    maxTokens: 600,
    cacheSystem: true,
  });
  const parsed = extractJSON<{ answer: string }>(text);
  return { question, answer: parsed.answer, agent: "Reasoning Agent" };
}
