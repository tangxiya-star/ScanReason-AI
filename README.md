# ScanReason AI

Radiology reasoning copilot for junior clinicians. Structured multi-agent
clinical reasoning over an MRI case — not a chatbot.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Architecture

- **Frontend**: Next.js App Router + React + TypeScript + Tailwind
- **3D**: @react-three/fiber + drei
- **Backend**: Next.js API routes (`/api/observe`, `/api/spatial-map`,
  `/api/reason`, `/api/checklist`, `/api/safety`, `/api/follow-up`)
- **AI**: Mock responses in `lib/mock.ts`. Swap `getObservation()`,
  `getReasoning()`, etc. for real LLM calls (TokenRouter-ready).

## Layout

- Left (≈55%): MRI viewer with ROI highlight + Explain / 3D buttons
- Right: Reasoning Panel — 5 stacked agent cards + sticky follow-up input
- Modals: Explain Mode, 3D Spatial View
