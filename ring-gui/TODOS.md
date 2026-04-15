# Ring GUI — Implementation Plan for Frontend Agent

This document is the **primary briefing** for the agent implementing the ring-gui frontend. Read this first. It explains what exists, what's needed, and what to build in what order.

---

## What Is This Project?

**dp-ring** is an "Adaptive Flywheel" for agent development workflows. It has three layers:

| Layer | Directory | Purpose |
|---|---|---|
| **Protocol data** | `.ring/` | JSON files (schemas, artifacts, config, leaderboard). The source of truth. |
| **Protocol library + API** | `ring/` | Node.js library + CLI + HTTP server. Reads/writes `.ring/`. Validates schemas, enforces state machines. |
| **Frontend (YOU)** | `ring-gui/` | React + TypeScript SPA. Visualizes and interacts with the ring API. |

The backend is **fully operational**. The API server runs at `http://localhost:3100`. During development, Vite proxies `/api/*` to the backend.

---

## What Already Exists

### Backend (complete, don't touch)

- `ring/server.mjs` — REST API. Start with `npm run ring:serve`.
- `docs/archive/legacy-adaptive-flywheel/ring/API.md` — legacy backend route documentation (historical reference).
- `ring/cli.mjs` — CLI for the same operations (useful for testing).
- `.ring/schemas/*.schema.json` — 10 JSON Schema definitions.
- `.ring/config.json` — Score weights, evolution settings, gate control.
- `.ring/sessions/`, `requirements/`, etc. — Seed data.

### Frontend scaffolding (your starting point)

- `ring-gui/main.tsx` — Entry point. Renders `<App />`.
- `ring-gui/App.tsx` — Placeholder root component.
- `ring-gui/styles.css` — Minimal base styles.
- `ring-gui/vite-env.d.ts` — Vite type declarations.
- `ring-gui/types/api.ts` — **Complete TypeScript types** for the entire API contract.
- `ring-gui/api/client.ts` — **Typed API client with all method signatures defined** but `get/post/patch` are stubs (throw `TODO: implement`).
- `ring-gui/components/` — Empty, ready for components.
- `ring-gui/hooks/` — Empty, ready for custom hooks.
- `ring-gui/pages/` — Empty, ready for page components.

### Config files (already updated for ring-gui/)

- `index.html` — Points to `ring-gui/main.tsx`.
- `tsconfig.json` — Includes `ring-gui/`, has `@ring-gui/*` path alias.
- `vite.config.ts` — Has `@ring-gui` alias, proxies `/api/*` to port 3100.

---

## How to Run

```bash
# Terminal 1: Start the backend API server
npm run ring:serve

# Terminal 2: Start the frontend dev server
npm run dev

# The frontend is at http://localhost:5173
# The API is at http://localhost:3100 (proxied via Vite)
```

---

## TODO List (Priority Order)

### Phase 1: Foundation (do these first)

- [ ] **T1: Implement the API client** (`ring-gui/api/client.ts`)
  - Implement the `get()`, `post()`, `patch()` helper functions.
  - They should call `fetch()`, parse JSON, and return `ApiResponse<T>`.
  - Handle network errors gracefully (return `{ ok: false, error: "..." }`, don't throw).
  - Test by calling `await listArtifacts("session")` from the browser console.

- [ ] **T2: Install a router** (react-router-dom recommended)
  - Routes needed (see Page Architecture below):
    - `/` → Dashboard
    - `/sessions` → Session list
    - `/sessions/:id` → Session detail
    - `/requirements` → Requirement list
    - `/requirements/:id` → Requirement detail
    - `/tasks` → Task list
    - `/tasks/:id` → Task detail
    - `/workflows` → Workflow template list
    - `/workflows/:id` → Workflow template detail
    - `/leaderboard` → Leaderboard view
    - `/knowledge` → Knowledge base (distillations)
    - `/feedback` → Feedback list

- [ ] **T3: Create application shell** (`ring-gui/components/Layout.tsx`)
  - Sidebar navigation with links to all routes.
  - Header with project name.
  - Content area for page components.
  - No fancy styling needed — functional first. A CSS framework (Tailwind, shadcn/ui, or plain CSS modules) is your choice.

### Phase 2: Core Pages

- [ ] **T4: Dashboard page** (`ring-gui/pages/Dashboard.tsx`)
  - Summary cards showing counts: active sessions, pending tasks, open feedback (critical/major), total workflows.
  - Recent session list (last 5, with status badges).
  - Quick-link buttons to create new requirement, session, or feedback.
  - Calls: `sessions.list()`, `tasks.list()`, `feedback.list()`, `workflows.list()`.

- [ ] **T5: Session list + detail pages**
  - **List** (`ring-gui/pages/SessionList.tsx`): Table of all sessions with id, status, requirement, dates. Filterable by status.
  - **Detail** (`ring-gui/pages/SessionDetail.tsx`):
    - Status badge with valid next-state buttons (query the API, the backend enforces transitions).
    - Linked requirement, milestone, tasks (clickable).
    - Execution log as a timeline.
    - If closed: show evaluation scores (radar chart or bar chart) and distillation summary.
    - "Get Agent Context" button that calls `/api/session/:id/context` and displays the JSON (or a formatted view).

- [ ] **T6: Requirement list + detail pages**
  - **List**: Table with id, name, status, priority, milestone count.
  - **Detail**: Shows acceptance criteria (checkboxes, read-only), linked milestones with gate status.
  - Gate evaluation: "Check Gate" button per milestone that calls `/api/gate/:milestoneId` and displays results (prerequisites pass/fail, blocking feedback).

- [ ] **T7: Task list + detail pages**
  - **List**: Table with id, name, status, task_type, linked session.
  - **Detail**: Acceptance criteria, linked workflow template, workflow run progress (step-by-step status).

- [ ] **T8: Workflow template list + detail pages**
  - **List**: Table with id, name, applicable_to, usage_count, avg_score.
  - **Detail**: Step definitions, quality history chart (recent_scores over time).

### Phase 3: Evolution & Knowledge

- [ ] **T9: Leaderboard page** (`ring-gui/pages/Leaderboard.tsx`)
  - Tab or dropdown to select task type.
  - Ranked table of workflows for that type: rank, workflow name, avg_score (bar or progress), usage_count.
  - Calls: `getRankings(taskType)`.

- [ ] **T10: Knowledge base page** (`ring-gui/pages/Knowledge.tsx`)
  - List of all published distillation artifacts.
  - Expandable to show individual knowledge items: kind, summary, context, confidence (color-coded), applicable_when.
  - Filter by context/task-type.
  - Calls: `distillations.list("published")`.

- [ ] **T11: Feedback page** (`ring-gui/pages/FeedbackList.tsx`)
  - Table: id, severity (color badge), category, target, status.
  - Filterable by severity and status.
  - Create feedback form (modal or inline).
  - Update status (acknowledge, resolve, wont_fix) via buttons.

### Phase 4: Interactive Features

- [ ] **T12: Evaluation view component** (`ring-gui/components/EvaluationCard.tsx`)
  - Displays the 5 quality dimensions as a radar chart (or 5 horizontal bars).
  - Shows composite score prominently.
  - Evidence section (tests passed, build status, tokens used, etc.).
  - Reused in SessionDetail and potentially Dashboard.

- [ ] **T13: Create/Edit forms**
  - Requirement creation form (name, description, priority, acceptance criteria).
  - Task creation form (name, description, task_type, requirement, milestone).
  - Session creation form (requirement, milestone, tasks).
  - Feedback creation form (severity, category, target, description, proposed_action).
  - All forms call the POST endpoints via the API client.
  - Validate locally before submitting (field presence, enums match the types).

- [ ] **T14: State transition UI**
  - For sessions, tasks, and feedback: show the current status and valid next states as action buttons.
  - The backend enforces validity, but the frontend should only show valid transitions.
  - Read the `x-state-machine` from schemas (fetch from `/api/session/<id>` and look at the schema), or hardcode the transition maps from `ring-gui/types/api.ts` (simpler).

### Phase 5: Polish

- [ ] **T15: Error handling and loading states**
  - Every API call should show a loading spinner while pending.
  - Errors should display in a toast/notification area, not crash the app.
  - 404 pages for unknown routes or missing artifacts.

- [ ] **T16: Responsive layout**
  - Sidebar should collapse on mobile.
  - Tables should be horizontally scrollable on small screens.

---

## Page Architecture

```
ring-gui/
├── main.tsx                    # Entry: renders App
├── App.tsx                     # Router provider + Layout wrapper
├── styles.css                  # Global styles (or Tailwind config)
├── vite-env.d.ts
├── api/
│   └── client.ts               # Typed API client (TODO: implement helpers)
├── types/
│   └── api.ts                  # Full TypeScript API contract (DONE)
├── components/
│   ├── Layout.tsx              # App shell: sidebar + header + content
│   ├── StatusBadge.tsx         # Color-coded status pill
│   ├── EvaluationCard.tsx      # Quality scores visualization
│   ├── TimelineLog.tsx         # Session execution log
│   ├── GateStatus.tsx          # Prerequisites pass/fail display
│   └── ...
├── hooks/
│   ├── useApi.ts               # Generic hook: fetch + loading + error state
│   └── ...
└── pages/
    ├── Dashboard.tsx
    ├── SessionList.tsx
    ├── SessionDetail.tsx
    ├── RequirementList.tsx
    ├── RequirementDetail.tsx
    ├── TaskList.tsx
    ├── TaskDetail.tsx
    ├── WorkflowList.tsx
    ├── WorkflowDetail.tsx
    ├── Leaderboard.tsx
    ├── Knowledge.tsx
    └── FeedbackList.tsx
```

---

## Data Model Quick Reference

Every artifact is a JSON object with this envelope:

```typescript
{
  id: string;
  type: ArtifactType;     // "session" | "task" | "requirement" | ...
  version: number;
  created_at: string;     // ISO-8601
  updated_at: string;
  created_by: string;
  session_id: string | null;
  status: string;         // type-specific enum
  data: { ... };          // type-specific payload
}
```

All types are defined in `ring-gui/types/api.ts`. Use them everywhere — don't use `any`.

## Status Enums (for badges and transitions)

| Type | Statuses |
|---|---|
| session | `gate_pending`, `preparing`, `executing`, `reviewing`, `closing`, `closed`, `failed` |
| task | `pending`, `ready`, `in_progress`, `completed`, `failed`, `cancelled` |
| requirement | `draft`, `analyzing`, `ready`, `in_progress`, `completed`, `archived` |
| milestone | `draft`, `active`, `blocked`, `satisfied`, `archived` |
| workflow | `active`, `deprecated`, `archived` |
| workflow-run | `pending`, `running`, `paused`, `completed`, `failed`, `aborted` |
| evaluation | `draft`, `final` |
| feedback | `open`, `acknowledged`, `in_progress`, `resolved`, `wont_fix` |
| distillation | `draft`, `published`, `archived` |

## Quality Dimensions (for evaluation visualizations)

| Dimension | Weight | What to show |
|---|---|---|
| Correctness | 0.30 | Tests pass, build succeeds |
| Completeness | 0.25 | Acceptance criteria coverage |
| Efficiency | 0.20 | Tokens, time, retries, human interventions (lower = better) |
| Adherence | 0.15 | Protocol compliance |
| Reusability | 0.10 | Assets formalized for future use |

---

## Constraints

- **React 19.x** (already installed). No class components.
- **TypeScript strict mode**. No `any` types.
- **No state management library required initially** — React state + context is fine. Add Zustand or similar only if you need it.
- **No SSR** — this is a pure SPA.
- The backend handles all validation and state machine enforcement. The frontend's job is to **display data correctly** and **send valid requests**.
- Use the types from `ring-gui/types/api.ts` for all API interactions.
- Use the path alias `@ring-gui/*` for imports within ring-gui.

---

## Testing

- Frontend tests go in `tests/ring-gui/`.
- Use Vitest (Vite-native) or React Testing Library.
- At minimum, test the API client helpers and key component rendering.

---

## Key Files to Read First

1. **This file** (`ring-gui/TODOS.md`) — you're here.
2. `ring-gui/types/api.ts` — the entire data model.
3. `ring-gui/api/client.ts` — the API client to implement.
4. `docs/archive/legacy-adaptive-flywheel/ring/API.md` — legacy backend route documentation.
5. `.ring/config.json` — score weights and settings the UI should reflect.
