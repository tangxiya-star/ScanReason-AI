# ScanReason AI

## Radiology Reasoning Copilot

### 1. Overview

ScanReason AI is an AI-powered radiology reasoning copilot designed to help junior clinicians and medical trainees interpret medical imaging through structured reasoning, spatial understanding, and guided explanations.

Instead of providing diagnoses, the system:

- Structures clinical thinking
- Explains findings
- Maps 2D → 3D spatial relationships
- Surfaces uncertainty and risks
- Generates report drafts

The system uses:

- Multi-agent architecture
- TokenRouter for model routing
- Reboot for interactive explanation

### 2. Problem Statement

Radiology interpretation is difficult, especially for junior clinicians:

- High cognitive load
- Fear of missing findings
- Weak spatial understanding from 2D slices
- Limited real-time feedback
- Slow report writing

Existing tools (PACS, textbooks, generic AI tools) do not provide:

- Structured reasoning workflows
- Interactive explanations
- Spatial understanding support

### 3. Goals

#### Primary Goal

Help clinicians think better, not replace them

#### Secondary Goals

- Reduce missed findings
- Improve spatial understanding (2D → 3D)
- Accelerate report writing
- Increase confidence in interpretation

### 4. Non-Goals

- Medical diagnosis
- Replacing radiologists
- Clinical decision authority
- Handling real patient data (MVP)

### 5. Target Users

#### Primary

- Radiology residents
- Medical students

#### Secondary

- Junior clinicians
- Individual doctors (personal tools)

#### Long-term

- Hospitals / imaging centers

### 6. Core Features

#### 6.1 MRI Viewer (2D)

- Brain MRI slice
- Highlighted region
- Slice indicator
- Buttons:
  - Explain this finding
  - Reconstruct in 3D

#### 6.2 Reasoning Panel (Agent-based)

Structured cards:

- Observation Agent
  - What is visible
- Spatial Mapping Agent
  - Where it is in 3D
  - Nearby structures
- Clinical Reasoning Agent
  - Why it matters
- Checklist Agent
  - What to verify
- Safety Agent
  - Confidence
  - Verification warning

#### 6.3 3D Spatial Reconstruction ⭐

Core feature:

- Converts 2D slice → 3D brain context
- Shows:
  - location
  - surrounding anatomy
  - spatial reasoning

> Focus: understanding, not precision

#### 6.4 Explain Mode (Reboot-powered) ⭐

Triggered by:

- “Explain this finding”

Outputs:

- What we see
- Why it matters
- What to compare
- Common mistake
- Report wording

#### 6.5 Follow-up Input

Compact input at bottom

Ask questions like:

- “Explain simpler”
- “What should I check next”

#### 6.6 Transparency Layer

Each output shows:

- Model used (TokenRouter)
- Confidence
- Safety flag

### 7. System Architecture

#### 7.1 Multi-Agent System

Agents:

- Observation
- Spatial Mapping
- Clinical Reasoning
- Checklist
- Safety
- Follow-up

#### 7.2 TokenRouter Integration ⭐

TokenRouter routes:

- vision tasks
- reasoning tasks
- drafting tasks
- safety checks

Purpose:

- optimize cost
- improve reliability
- enable multi-model system

#### 7.3 Reboot Integration ⭐

Reboot is used ONLY for:

- Explain Mode
- Interactive learning flow

#### 7.4 Spatial Layer

- Maps 2D slice → 3D brain
- Provides anatomical context

### 8. UI Design

Layout:

- Left: MRI viewer
- Right: reasoning panel
- Floating: 3D panel
- Modal: explain mode

Key principle:

- Not a chatbot — a structured reasoning system

### 9. MVP Scope (6 Hours)

Must have:

- MRI image + highlight
- Reasoning panel (cards)
- Explain mode
- 3D panel (mock)
- Follow-up input

Nice to have:

- Model routing display
- Confidence
- Animations

### 10. Success Metrics

Demo success:

- Clarity
- UI quality
- perceived usefulness
- system understanding

Future metrics:

- time saved
- user trust
- daily usage

### 11. Customer & Market

Beachhead:

- Radiology trainees

TAM:

- $5B–$20B AI medical imaging market

SAM:

- $300M–$1B (training + workflow tools)

SOM:

- $3M–$10M early wedge

### 12. Positioning

Not:

- AI diagnosis

But:

- A reasoning copilot that helps clinicians think better and safer.

---

## TECH STACK (完整版本)

### Frontend

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Purpose:

- UI structure
- agent cards
- layout
- 3D Layer

### 3D

- Three.js
- @react-three/fiber
- @react-three/drei

Purpose:

- 3D brain visualization
- highlighted region

### Backend

- Next.js API routes

Endpoints:

- /api/observe
- /api/spatial-map
- /api/reason
- /api/checklist
- /api/safety
- /api/follow-up

### AI / Agent Layer

- TokenRouter (routing layer)

Agents:

- Observation Agent
- Spatial Mapping Agent
- Reasoning Agent
- Checklist Agent
- Safety Agent
- Follow-up Agent

Models（实际 + 理想）

Hackathon现实：

- Claude / GPT（1–2个模型）

理想架构：

- Vision model（observation）
- Strong reasoning model
- Lightweight drafting model
- Safety cross-check model
- Reboot

用途：

- Explain Mode
- interactive reasoning

Data

MVP：

- mock MRI image
- hardcoded case
- location: left temporal
- structures: hippocampus
- confidence: medium

Deployment

- Vercel

### 🚀 最终架构总结

Frontend:

- Next.js + Tailwind + React

3D:

- Three.js

Backend:

- Next API

AI:

- TokenRouter + LLMs

Explain:

- Reboot

Data:

- Mock

Deploy:

- Vercel
