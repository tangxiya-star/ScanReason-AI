import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODEL_FAST = "claude-sonnet-4-6";
export const MODEL_DEEP = "claude-opus-4-7";

let cachedImage: { media: string; data: string } | null = null;

export type ClientImage = { media: string; data: string };

export function loadMRIImage(override?: ClientImage | null): ClientImage {
  if (override && override.data) return override;
  if (cachedImage) return cachedImage;
  const p = path.join(process.cwd(), "public", "sample-mri.jpg");
  const buf = fs.readFileSync(p);
  cachedImage = { media: "image/jpeg", data: buf.toString("base64") };
  return cachedImage;
}

export const CASE_BRIEF = `
Patient ID: PT-MS-01
Modality: MRI Brain — T2 FLAIR (3D, isotropic)
Acquisition: axial / coronal / sagittal reformats from a single 3D FLAIR volume
Anatomic regions of interest: periventricular white matter, juxtacortical white matter, corpus callosum, centrum semiovale
Image annotation: any cyan-tinted voxels in the slice represent pre-segmented lesions from a consensus expert ground-truth mask
Clinical context: outpatient demyelinating-disease workup; junior clinician case review; reader is learning structured radiology reasoning
Reading guidance: describe what you observe on the slice presented; if no cyan-tinted regions are visible the slice should be considered unremarkable on this read
`.trim();

export const SYSTEM_BASE = `You are part of ScanReason AI — a multi-agent radiology reasoning copilot for junior clinicians.

Style:
- Be precise, concise, clinically grounded.
- Never assert a definitive diagnosis from a single image. Use language like "compatible with", "raises concern for", "consider".
- Acknowledge uncertainty explicitly when present.
- Always recommend clinical/laboratory correlation when imaging is non-specific.

Output format:
- You must output ONLY a single valid JSON object matching the schema specified in the user prompt.
- No prose before or after the JSON. No markdown code fences.
`.trim();

export type AgentBlock = { body: string[] };

export function extractJSON<T = any>(text: string): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in model output");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
