# Repository Directory Structure

## Top-Level

| Path | Purpose |
|---|---|
| `.ring/` | Machine-readable state: JSON Schema definitions, artifact records, config, leaderboard. Git-tracked. |
| `ring/` | Protocol library (Node.js): validator, state machine, store, registry, evaluator, gate, query. Plus CLI (`cli.mjs`), REST API server (`server.mjs`), and API docs (`API.md`). |
| `ring-gui/` | Frontend SPA (React + TypeScript + Vite): dashboard for visualizing and managing ring artifacts. See `ring-gui/TODOS.md` for implementation plan. |
| `docs/` | Human-readable documentation (legacy Adaptive Flywheel docs, specs, requirements). |
| `cli-tool/` | Legacy CLI for document naming conventions and markdown template generation. |
| `tests/` | All tests: `tests/ring/` for protocol library, `tests/cli-tool/` for legacy CLI. |
| `prototype/` | Design originals (`.md`, `.drawio`). |

## `.ring/` (Machine-Readable State)

| Path | Contents |
|---|---|
| `schemas/` | 10 JSON Schema files defining every artifact type |
| `config.json` | Score weights, evolution settings, gate control flags, directory mappings |
| `sessions/` | Session lifecycle records |
| `requirements/` | Structured requirement records |
| `milestones/` | Milestone records with machine-evaluable prerequisites |
| `tasks/` | Task records |
| `workflows/` | Reusable workflow templates |
| `workflow-runs/` | Per-task workflow execution instances |
| `evaluations/` | Quality scoring records |
| `registry/` | Leaderboard (`leaderboard.json`) |
| `feedback/` | Structured feedback with severity triage |
| `distillations/` | Knowledge artifacts (lessons, patterns, anti-patterns) |

## `ring/` (Protocol Library)

| Path | Purpose |
|---|---|
| `index.mjs` | Main entry: `createRing()` API |
| `cli.mjs` | CLI interface (10 commands) |
| `server.mjs` | HTTP REST API server |
| `API.md` | API documentation |
| `lib/validator.mjs` | Ajv-based JSON Schema validation |
| `lib/state-machine.mjs` | State transition enforcement |
| `lib/store.mjs` | File-based CRUD with validation |
| `lib/registry.mjs` | Leaderboard management + explore/exploit selection |
| `lib/evaluator.mjs` | 5-dimension quality scoring |
| `lib/gate.mjs` | Programmatic prerequisite evaluation |
| `lib/query.mjs` | Query/filter utilities, knowledge relevance, feedback triage |
| `lib/id.mjs` | Artifact ID generation |

## `ring-gui/` (Frontend)

| Path | Purpose |
|---|---|
| `main.tsx` | Entry point |
| `App.tsx` | Root component (placeholder) |
| `types/api.ts` | Complete TypeScript type contract |
| `api/client.ts` | Typed API client (stubs) |
| `components/` | Shared UI components (empty) |
| `hooks/` | Custom React hooks (empty) |
| `pages/` | Page components (empty) |
| `TODOS.md` | Full implementation plan for frontend agent |

## Build & Deploy

| Path | Purpose |
|---|---|
| `index.html` | Vite entry HTML (points to `ring-gui/main.tsx`) |
| `vite.config.ts` | Vite config with `@ring-gui` alias and API proxy |
| `tsconfig.json` | TypeScript config (includes `ring-gui/`) |
| `eslint.config.js` | ESLint (browser globals for `.tsx`, Node globals for `.mjs`) |
| `Dockerfile` | Multi-stage: Node build + nginx static |
| `nginx.conf` | SPA-friendly nginx config |
| `package.json` | Scripts: `dev`, `build`, `ring`, `ring:serve`, `test`, `lint`, `typecheck` |
