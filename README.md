# ScanReason AI

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Claude](https://img.shields.io/badge/Claude-Opus%204.7%20%2B%20Sonnet%204.6-D97757)](https://www.anthropic.com/)
[![TokenRouter](https://img.shields.io/badge/TokenRouter-sponsor-7C3AED)](https://tokenrouter.com/)
[![Reboot](https://img.shields.io/badge/Reboot-skill-EC4899)](#reboot-)
[![Status](https://img.shields.io/badge/status-MVP-22C55E)](#)

**A radiology reasoning copilot for junior clinicians.**
Structured multi-agent clinical reasoning over an MRI case — not a chatbot.

> **Mission:** Help clinicians _think_ better, not replace them. ScanReason
> structures the reasoning, surfaces uncertainty, and explains findings — but
> never asserts a diagnosis.

---

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3000
```

Required env vars in `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...                       # required (LLM)
TOKENROUTER_API_KEY=sk-tr-...                      # optional (sponsor; auto-falls back to direct Claude)
TOKENROUTER_BASE_URL=https://api.tokenrouter.com   # optional
```

Drop the Reboot skill (optional) at `skills/reboot/SKILL.md` — see
[`skills/reboot/README.md`](skills/reboot/README.md).

---

## What it does

| Capability | UI surface |
|---|---|
| Load any DICOM folder, scrub axial slices | MRI viewer (left) |
| Five specialist agents read the current slice in parallel | Reasoning panel (right) |
| Teaching read with 5 framed sections | Explain Mode modal |
| 2D → 3D spatial reconstruction with highlighted ROI | 3D Spatial View modal |
| Targeted follow-up question over the same slice | Sticky input (bottom-right) |

---

## Agent workflow (multi-agent, real-time streaming)

When you click **Re-analyze**, the current slice is captured from the canvas,
encoded, and sent to a streaming endpoint that fans out to **five Claude agents
in parallel**. Each card fills in independently as its agent finishes.

```
                                 ┌──────────────────────────┐
                                 │   MRI Viewer (canvas)    │
                                 │   user-loaded DICOM      │
                                 └────────────┬─────────────┘
                                              │ canvas.toDataURL("image/jpeg")
                                              ▼
                                ┌──────────────────────────────┐
                                │  POST /api/analyze-stream    │
                                │  (Server-Sent Events)        │
                                └──────────────┬───────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │              routeLLM()  ── per task          │
                       │     ┌──────────────┬──────────────────┐       │
                       │     │ TokenRouter  │  Anthropic SDK   │       │
                       │     │  (sponsor)   │  (fallback)      │       │
                       │     └──────────────┴──────────────────┘       │
                       └────────────┬──────────────────────────────────┘
                                    │ 5 parallel calls (Promise.all)
       ┌───────────────┬────────────┼─────────────┬──────────────────┐
       ▼               ▼            ▼             ▼                  ▼
 ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐
 │Observation│  │   Spatial    │  │ Clinical │  │  Checklist │  │  Safety  │
 │   Agent   │  │   Mapping    │  │ Reasoning│  │    Agent   │  │   Agent  │
 │           │  │    Agent     │  │   Agent  │  │            │  │          │
 ├──────────┤  ├──────────────┤  ├──────────┤  ├────────────┤  ├──────────┤
 │ what is  │  │  where it    │  │  ranked  │  │  next      │  │  conf-   │
 │ visible  │  │  is in 3D    │  │  diff-   │  │  imaging / │  │  idence, │
 │ (signal, │  │  (laterality,│  │  Dx with │  │  clinical  │  │  do-not- │
 │ symmetry,│  │  neighbors,  │  │  one-line│  │  steps to  │  │  miss    │
 │ swelling)│  │  slice ctx)  │  │  reasons │  │  verify    │  │  flags   │
 └─────┬────┘  └──────┬───────┘  └─────┬────┘  └──────┬─────┘  └─────┬────┘
       │              │                │              │              │
       └──────────────┴────────────────┴──────────────┴──────────────┘
                                       │ each emits an SSE event
                                       ▼
                          ┌───────────────────────────┐
                          │  Reasoning Panel UI       │
                          │  • progress bar fills     │
                          │  • each card flips from   │
                          │    "Thinking" → "Done"    │
                          │    in arrival order       │
                          └───────────────────────────┘

  Two on-demand agents (separate endpoints):

   ┌───────────────────────┐         ┌──────────────────────┐
   │  Explain Agent        │         │  Follow-up Agent     │
   │  (Reboot skill, opt.) │         │  POST /api/follow-up │
   │  POST /api/explain    │         │  user-typed question │
   │  → 5-section teaching │         │  → 2–4 sentence reply│
   │    read of slice      │         │  scoped to this case │
   └───────────────────────┘         └──────────────────────┘
```

### Agents at a glance

| Agent | Input | Output | Purpose |
|---|---|---|---|
| **Observation** | slice | 3 bullets | What is visible — signal, symmetry, mass effect |
| **Spatial Mapping** | slice | 3 bullets | Where it is — laterality, neighboring structures |
| **Clinical Reasoning** | slice | 3 bullets | Ranked differential with one-line justifications |
| **Checklist** | slice | 4 bullets | What to verify next — priors, sequences, labs, exam |
| **Safety** | slice | 3 bullets | Confidence, do-not-miss flags, senior read advisory |
| **Explain** | slice | 5 sections | Teaching read: see / why / compare / mistake / wording |
| **Follow-up** | slice + Q | answer | Targeted clarification on demand |

Every card footer reads `<Agent> · Routed via TokenRouter`, making the routing
layer explicit to the user.

---

## How clinicians use it

### Beachhead users

- **Radiology residents** preparing for read-outs
- **Medical students** learning to interpret cross-sectional imaging
- **Junior clinicians** ordering and reviewing scans without an immediate
  radiologist available

### Clinical workflow (intended)

```
  1. Load study             →  user opens a DICOM folder; slices auto-sort
                                by SliceLocation / InstanceNumber

  2. Scrub to a slice        →  scroll wheel or slider selects the axial
                                level the reader wants to reason about

  3. Run agents              →  click Re-analyze. The five agents read the
                                exact slice on screen and stream back:
                                  • what they see  (Observation)
                                  • where it sits  (Spatial Mapping)
                                  • what it could be  (Clinical Reasoning)
                                  • what to verify  (Checklist)
                                  • how confident   (Safety)

  4. Open Explain Mode       →  click "Explain this finding" for a teaching
                                walk-through:
                                  • What we see (plain language)
                                  • Why it matters (do-not-miss diagnoses)
                                  • What to compare (priors, contralateral,
                                    other sequences)
                                  • Common mistake (typical junior error)
                                  • Suggested report wording (paste-ready)

  5. Reconstruct in 3D       →  spatial agent's anatomic context rendered
                                as a 3D ROI to build mental geometry

  6. Ask follow-up           →  type a targeted question:
                                  "Why does this matter?"
                                  "What should I compare to?"
                                  "How do I phrase this in the report?"

  7. Cross-check & escalate  →  Safety agent always names a senior /
                                neuro-radiology second-read as the next
                                step. Confidence is always surfaced.
```

### Concrete clinical scenarios

**Demyelinating disease workup (e.g. multiple sclerosis)**
The reader scrubs through a 3D FLAIR series and stops on a slice with
periventricular hyperintensities. The Observation agent describes the
lesions; the Spatial Mapping agent flags peri-callosal and juxtacortical
involvement; the Reasoning agent ranks MS, ADEM, small-vessel ischemic
disease and neurosarcoidosis; the Checklist agent recommends spinal cord
imaging, post-contrast T1, CSF studies; the Safety agent reminds the
reader that DIS + DIT (McDonald criteria) cannot be assessed from a
single slice.

**Suspected encephalitis**
On a slice with asymmetric temporal hyperintensity, the Reasoning agent
surfaces HSV encephalitis as a do-not-miss; the Safety agent explicitly
escalates to empiric acyclovir territory pending CSF PCR.

**Teaching read for a medical student**
The student doesn't know what they're looking at. Explain Mode walks
through five framed questions in plain language and provides paste-ready
report wording so the student can compare their own draft against a
hedged template.

### Non-goals

This system is **not** a diagnostic device. Per the PRD it explicitly does
not:

- make diagnoses
- replace radiologists
- carry clinical decision authority
- handle real PHI in this MVP

Every output is hedged ("compatible with", "raises concern for"), and the
Safety agent always recommends a senior second-read.

---

## Architecture

```
app/
├── page.tsx                       # main shell (header, two-pane, modals)
├── api/
│   ├── analyze-stream/route.ts    # SSE: 5 parallel agents → events
│   ├── explain/route.ts           # 5-section teaching read
│   └── follow-up/route.ts         # targeted Q&A
└── globals.css                    # dark glassy theme

components/
├── MRIViewer.tsx                  # DICOM parser + canvas + slice scrubber
├── ReasoningPanel.tsx             # SSE consumer + progress bar + cards
├── AgentCard.tsx                  # idle / running / done / error states
├── ExplainModal.tsx               # 5-section modal (loads on open)
├── Spatial3DPanel.tsx             # react-three-fiber 3D ROI
└── ChatInput.tsx                  # sticky structured-input (no chat UI)

lib/
├── agents.ts                      # per-agent prompts + JSON contracts
├── anthropic.ts                   # client + system prompt + image cache
├── tokenrouter.ts                 # sponsor routing + fallback
├── reboot.ts                      # Reboot skill loader for Explain Mode
├── imageBus.ts                    # canvas → server image getter
├── mock.ts                        # case metadata (PT, slice, region)
└── utils.ts                       # cn() helper
```

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind | dark medical theme |
| 3D | three.js + @react-three/fiber + drei | minimal brain ROI |
| DICOM | `dicom-parser` (client-side) + canvas windowing | no PHI leaves the browser |
| Backend | Next.js API routes (Node runtime) | streaming via `ReadableStream` |
| LLM | Claude Sonnet 4.6 (cards/follow-up), Opus 4.7 (Explain) | via Anthropic SDK |
| Routing | **TokenRouter** (sponsor) → falls back to direct Anthropic | task-class → model map |
| Teaching | **Reboot** skill (sponsor) → falls back to plain prompt | drop SKILL.md to activate |

---

## Sponsor integrations

### TokenRouter ⭐

Routes each task class (`vision` / `reason` / `draft` / `safety`) to a model
through TokenRouter's Anthropic-compatible endpoint. See
[`lib/tokenrouter.ts`](lib/tokenrouter.ts). Failures auto-fallback to direct
Anthropic so the demo never breaks.

### Reboot ⭐

Reboot ships as a Claude skill, not an HTTP API. The Explain Mode loader
([`lib/reboot.ts`](lib/reboot.ts)) reads `skills/reboot/SKILL.md`, strips
frontmatter, and prepends the skill body to the Explain system prompt. A
parallel Reboot MCP App for Explain Mode (scaffolded via
`/reboot-chat-app`) can be demoed standalone via `mcpjam/inspector`.

#### How to use Reboot in this app

1. **Drop the skill file** at [`skills/reboot/SKILL.md`](skills/reboot/SKILL.md).
   Frontmatter (`name:`, `description:`) is required; the body is the system
   prompt that gets injected into Explain Mode.
2. **Restart the dev server** (`npm run dev`). The loader caches by mtime, so
   subsequent edits are picked up without restart.
3. **Trigger Explain Mode** in the UI — click "Explain this finding" on any
   agent card. The modal header shows a `REBOOT SKILL ACTIVE` badge when the
   skill loaded, or `FALLBACK` when the file is missing.
4. **Verify the skill is influencing output** (not just being loaded):
   - Look for skill-specific phrasing in `commonMistake` / `whyItMatters`
     fields — generic outputs mean the prompt isn't landing.
   - For a hard test, add a sentinel line to SKILL.md (e.g. *"end every
     `commonMistake` with the literal token `[REBOOT]`"*) and confirm the
     token appears in the response. Remove before committing.
5. **Customize the pedagogy** by editing the skill body. The default
   ([`skills/reboot/SKILL.md`](skills/reboot/SKILL.md)) implements a
   four-beat teaching model (See / Name / Reason / Probe) mapped onto the
   host app's existing JSON contract — do not rename the JSON fields.

#### Next steps (post-MVP)

- **Standalone MCP app**: expose Explain Mode as a Reboot MCP server so it
  can be invoked from Claude Code, ChatGPT, VS Code, or Goose without
  visiting the web app. Scaffold lives under `skills/` via `/reboot-chat-app`.
- **Skill versioning**: pin the skill body's expected version in
  `lib/reboot.ts` and warn if the loaded SKILL.md is older — useful when
  Reboot ships pedagogy updates.
- **Per-modality skills**: split into `skills/reboot-mri/`, `skills/reboot-ct/`,
  etc., and route by `case.modality` in [`lib/reboot.ts`](lib/reboot.ts).
- **Telemetry**: log the `provider` field from `/api/explain` responses to
  measure how often the skill actually loads in production.

---

## Privacy

- DICOM parsing runs **entirely in the browser**. The raw `.dcm` bytes
  never leave the device.
- Only the rendered slice (JPEG, current window/level) is sent to the LLM.
- No persistence: nothing is stored server-side, no database, no PHI logs.

---

## Limitations

- Sonnet/Opus are general-purpose foundation models, not radiology-specialist
  models. Differential diagnosis lists are reasonable but generic.
- Single-slice reasoning by design — longitudinal comparisons (DIT for MS,
  follow-up tumors) require workflow extensions outside this MVP.
- The "Highlighted ROI" overlay on the placeholder image is decorative only;
  with a user-uploaded DICOM there is no pre-segmentation — the agents read
  the slice as presented.

---

## Roadmap

- Spinal cord + multi-series reasoning (DIS / DIT for MS)
- Per-agent model routing tuned via TokenRouter analytics
- Reboot MCP App as a reusable Explain service callable from any MCP client
  (Claude Code, ChatGPT, VS Code, Goose)
- DICOM SEG / RTSTRUCT overlay support to ground spatial agent on real masks
