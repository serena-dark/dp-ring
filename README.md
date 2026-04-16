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

Rust is not installed in the current execution environment, so the Rust services were scaffolded but not compiled here.

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
```

The root regression suite now includes both `npm run v2:web:typecheck` and `npm run v2:web:build`, so a green `npm test` confirms the dedicated operator-web typecheck and production build entrypoints. Run `npm run v2:web:install` before app-local commands if the operator-web dependencies are not installed yet.

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
