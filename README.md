# dp-ring v2

dp-ring v2 is a fresh control-plane rebuild for agent delivery workflows.

The repository now contains a new platform shape:

- `apps/operator-web`
  TypeScript operator console built with React, TanStack Router, and TanStack Query.
- `services/control-api`
  Rust REST + SSE gateway for viewer bootstrap, resource collections, and live activity.
- `services/orchestrator`
  Rust command-side scaffold for Objectives, Blueprints, WorkItems, and Reviews.
- `services/runtime-broker`
  Rust runtime scaffold for worker connectivity, leases, and execution reporting.
- `services/knowledge-hub`
  Rust knowledge service scaffold for Findings and Insights.
- `agents/worker-daemon`
  Rust local worker scaffold.
- `contracts/openapi`
  Public control-plane HTTP contract.
- `contracts/proto`
  Internal gRPC and event message contracts.
- `infra/compose`
  Postgres, NATS JetStream, MinIO, and Keycloak for local platform bootstrapping.

## Current state

This turn implements:

- a Rust workspace skeleton for all planned services
- shared domain/read-model types under `crates/platform-types`
- a functional `control-api` scaffold with REST collection endpoints and an SSE activity stream
- a new operator console under `apps/operator-web`
- local infrastructure compose definitions
- v2 contracts and architecture docs

Current maturity notes:

- `services/control-api` is the most functional Rust surface today, but it still serves seeded `demo_snapshot()` read models from `crates/platform-types` rather than a live projection pipeline.
- `services/orchestrator` and `services/knowledge-hub` still boot from the same seeded snapshot data and currently act as service-shape scaffolds rather than independent persistent services.
- `services/runtime-broker` currently proves the runtime process shape and health endpoint, but not the full end-to-end control-plane flow.
- The managed local stack (`npm run stack:verified-restart`) remains the practical integration path for day-to-day development while the Rust services continue to mature.
- The root regression suite now compiles `services/control-api` with `cargo check -p control-api` whenever the Rust toolchain is available, so a green `npm test` validates the most active v2 Rust surface instead of leaving it purely scaffolded.

## Operator web

Bootstrap the app-local frontend dependencies before running the operator console commands:

```bash
npm run v2:web:install
npm run v2:web:dev
```

Equivalent direct commands:

```bash
npm --prefix apps/operator-web ci
npm --prefix apps/operator-web run dev
```

Useful root shortcuts:

```bash
npm run v2:web:install
npm run v2:web:dev
npm run v2:web:build
npm run v2:web:typecheck
npm run test:frontend
npm run test:backend
```

The root regression suite now includes both `npm run v2:web:typecheck` and `npm run v2:web:build`, so a green `npm test` confirms the dedicated operator-web typecheck and production build entrypoints. Use `npm run test:frontend` for the `tests/operator-web/**/*.test.ts` coverage and `npm run test:backend` for the root `node:test` suites. Run `npm run v2:web:install` before app-local commands if the operator-web dependencies are not installed yet.

## Managed local stack

For the current day-to-day local workflow, use the managed stack scripts at the repo root:

```bash
npm run stack:verified-restart
npm run stack:status
```

- `npm run stack:verified-restart` runs the full regression suite first, then rebuilds the preview frontend and starts the managed backend/frontend pair.
- `npm run stack:status` reports whether the recorded processes are still alive and whether the backend, frontend, and frontend API proxy are healthy.
- Runtime state and logs live under `.ring/runtime/`, including `backend.log`, `frontend.log`, and `service-stack.json`.
- To route loopback automation through the Kimi-backed remote agent path, set `DP_RING_REMOTE_AGENT_PROVIDER=kimi` in `.env.local` (see `.env.example`).

The currently validated managed endpoints are:

```text
Frontend: http://127.0.0.1:4174/
Backend:  http://127.0.0.1:3100/
Proxy:    http://127.0.0.1:4174/api/orchestrator/workers
```

This managed stack is the practical local integration path today. The Rust `services/control-api` scaffold below remains the longer-term v2 target surface, and its current responses still come from seeded snapshot data rather than live service-backed projections.

## Control API

The intended local endpoint is:

```text
http://127.0.0.1:7400
```

Implemented routes in the scaffold:

- `GET /healthz`
- `GET /api/bootstrap`
- `GET /api/orgs`
- `GET /api/workspaces`
- `GET /api/repositories`
- `GET /api/objectives`
- `GET /api/blueprints`
- `GET /api/work-items`
- `GET /api/executions`
- `GET /api/reviews`
- `GET /api/findings`
- `GET /api/insights`
- `GET /api/workers`
- `GET /api/activity`
- `GET /api/activity/stream`

## Local platform infrastructure

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

Services:

- Postgres on `5432`
- NATS JetStream on `4222`
- NATS monitor on `8222`
- MinIO on `9000` and console on `9001`
- Keycloak on `8080`

## Documentation

- [docs/v2/ARCHITECTURE.md](./docs/v2/ARCHITECTURE.md)
- [contracts/openapi/openapi.yaml](./contracts/openapi/openapi.yaml)
- [contracts/proto/control_plane.proto](./contracts/proto/control_plane.proto)
