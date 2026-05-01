# ScanReason AI

> A radiology reasoning copilot for junior clinicians.
> Multi-agent. Spatial. Explainable. Not a chatbot.

---

## The problem

Radiology interpretation is hard, especially for trainees:

- **High cognitive load** — every slice is a search problem
- **Fear of missed findings** — junior readers over-fixate or under-call
- **Weak spatial intuition** — a 2D slice is not a 3D understanding
- **No real-time feedback** — readers wait days for attending sign-off
- **Slow report writing** — wording is hedged, formal, easy to get wrong

Existing tools — PACS, textbooks, generic AI chatbots — solve none of this.
They show pixels, dump information, or generate a single confident answer.
None of them **structure the reasoning**.

---

## The solution

ScanReason AI sits next to the slice and runs five specialist agents in
parallel over whatever the reader is currently looking at:

| Agent | Question it answers |
|---|---|
| **Observation** | What is visible? |
| **Spatial Mapping** | Where is it, and what's around it? |
| **Clinical Reasoning** | What could this be, ranked? |
| **Checklist** | What should I verify next? |
| **Safety** | How confident are we, and what must we not miss? |

Two on-demand agents extend the reading:

- **Explain Mode** — a 5-section teaching read (what we see / why it matters /
  what to compare / common mistake / suggested report wording)
- **Follow-up** — targeted Q&A scoped to the current slice ("why does this
  matter?", "how do I phrase this?")

The reader always sees:
- The agent that produced each answer
- The routing layer it traversed (TokenRouter)
- Confidence and do-not-miss flags

**The product never asserts a diagnosis.** Every output is hedged. The Safety
agent always recommends a senior or neuro-radiology second-read.

---

## How it works (60 seconds)

1. The reader loads a DICOM folder. Parsing happens **entirely in the
   browser** — raw `.dcm` bytes never leave the device.
2. The reader scrubs to a slice (mouse wheel or slider).
3. The current slice is captured from the canvas as JPEG and POSTed to a
   streaming endpoint.
4. Five Claude agents fan out in parallel through TokenRouter. Each emits
   an SSE event when it finishes.
5. The Reasoning Panel UI fills in card-by-card in arrival order, with a
   progress bar at the top.
6. Click **Explain this finding** for a teaching read, **Reconstruct in 3D**
   for spatial context, or type a follow-up question — each routes to its
   own dedicated agent.

End-to-end latency on a fresh slice: ~5–8 seconds for the first card to
appear, all five complete within ~10 seconds.

---

## What's actually real

| Component | State |
|---|---|
| DICOM upload + slice scrubbing | ✅ real (`dicom-parser`, canvas windowing) |
| 5 streaming agents over the current slice | ✅ real (Claude Sonnet 4.6 + Vision) |
| Explain Mode | ✅ real (Claude Opus 4.7 + Vision, optional Reboot skill) |
| Follow-up Q&A | ✅ real (Claude Sonnet 4.6 + Vision) |
| TokenRouter routing | ✅ wired (auto-fallback to direct Anthropic on error) |
| 3D Spatial View | ✅ rendered (react-three-fiber); textual context still hardcoded |
| Privacy | ✅ no PHI server-side, no persistence, no logs |

No mocks behind the agent cards. The system genuinely sees the user's
slice and reasons over it.

---

## Sponsor integrations

### TokenRouter ⭐

Every agent call goes through [`lib/tokenrouter.ts`](lib/tokenrouter.ts),
which maps a task class (`vision` / `reason` / `draft` / `safety`) to a
specific model on TokenRouter's Anthropic-compatible endpoint. On any
error, the call falls back to direct Anthropic so the demo never breaks.

Each card footer in the UI reads
`<Agent Name> · Routed via TokenRouter`, making the routing layer
explicit to the user.

### Reboot ⭐

Reboot ships as a Claude Skill rather than a runtime API. The Explain
Mode loader at [`lib/reboot.ts`](lib/reboot.ts) reads
`skills/reboot/SKILL.md`, strips frontmatter, and prepends the skill body
to the Explain system prompt — so when the skill is installed, the
teaching layer is genuinely shaped by Reboot's pedagogy.

A parallel Reboot MCP App for Explain Mode (scaffolded with
`/reboot-chat-app`) is the natural next step: it would expose the same
teaching read as an MCP tool, callable from Claude Code, ChatGPT, VS
Code, or Goose.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind |
| 3D | three.js + @react-three/fiber + drei |
| DICOM | `dicom-parser` (client-side) + canvas windowing |
| Backend | Next.js API routes, Server-Sent Events streaming |
| LLM | Claude Sonnet 4.6 + Opus 4.7 (vision-enabled) |
| Routing | TokenRouter (Anthropic-compatible API) |
| Teaching | Reboot Claude Skill |

---

## Clinical scenarios

**Demyelinating disease (e.g. multiple sclerosis)**
On a periventricular FLAIR slice, the Observation agent describes ovoid
hyperintensities; Spatial Mapping flags peri-callosal and juxtacortical
involvement; Reasoning ranks MS, ADEM, small-vessel disease, and
neurosarcoidosis; Checklist requests spinal cord imaging, post-contrast
T1, and CSF studies; Safety reminds the reader that McDonald criteria
(DIS + DIT) cannot be assessed from one slice.

**Suspected encephalitis**
On a slice with asymmetric temporal hyperintensity, Reasoning surfaces
HSV encephalitis as a do-not-miss; Safety explicitly escalates to
empiric acyclovir territory pending CSF PCR.

**Teaching read for a medical student**
Explain Mode walks the student through five framed questions in plain
language and provides paste-ready report wording — so the student can
compare their own draft against a hedged template instead of copying a
chatbot's confident sentence.

---

## What it is not

- ❌ A diagnostic device
- ❌ A radiologist replacement
- ❌ A clinical decision authority
- ❌ A handler of real patient identifiers (this MVP)
- ❌ A chatbot — there are no message bubbles, only structured cards

---

## Market

- **Beachhead:** radiology trainees and medical students (~25k US residents,
  ~90k US medical students; multiply by global)
- **Wider TAM:** AI medical imaging, $5B–$20B
- **Wedge:** training + workflow for junior clinicians, $300M–$1B
- **Realistic SOM:** $3M–$10M

---

## Team & build notes

Built as a hackathon MVP with a strict 6-hour time box. Architectural
decisions optimized for:

- **Clarity of demo** — the multi-agent fan-out is visible to the user via
  the streaming progress bar and per-card status badges
- **Sponsor integration depth** — TokenRouter is real and load-bearing;
  Reboot is integrated as a runtime-loaded skill (not just a logo)
- **Correctness over cleverness** — every output is hedged, every agent has
  a one-purpose contract, no system prompt overlap

---

## Roadmap

- Spinal cord + multi-series reasoning (DIS / DIT for MS)
- Per-agent model routing tuned via TokenRouter analytics
- Reboot MCP App as a reusable Explain service callable from any MCP
  client (Claude Code, ChatGPT, VS Code, Goose)
- DICOM SEG / RTSTRUCT overlay support to ground the spatial agent on
  real masks rather than reader-implied geometry

---

## Positioning

> **Not** AI diagnosis.
> **A reasoning copilot that helps clinicians think better and safer.**
