# Document Index

This document is the top-level index for the current `dp-ring v2` repository. It separates active platform documentation from legacy material so only one set of documents acts as the current source of truth.

## Current Platform

| Document | Purpose |
|---|---|
| [README.md](./README.md) | Project introduction, local startup paths, active scripts |
| [VALUE.md](./VALUE.md) | Current platform value, operating model, and design principles |
| [docs/v2/ARCHITECTURE.md](./docs/v2/ARCHITECTURE.md) | Active platform architecture and service topology |
| [docs/repository-layout.md](./docs/repository-layout.md) | Current repository structure and ownership boundaries |
| [docs/documentation-standards.md](./docs/documentation-standards.md) | Current Markdown and code-comment governance |

## Contracts

| Document | Purpose |
|---|---|
| [contracts/openapi/openapi.yaml](./contracts/openapi/openapi.yaml) | Public REST contract for the operator console |
| [contracts/proto/control_plane.proto](./contracts/proto/control_plane.proto) | Internal control-plane gRPC and event contract |
| `contracts/proto/*.proto` | Additional internal service and worker contracts |

## Runtime Components

| Path | Purpose |
|---|---|
| `apps/operator-web/` | React operator console |
| `services/control-api/` | REST + SSE gateway and read-model delivery |
| `services/orchestrator/` | Objective, Blueprint, WorkItem, and Review command flows |
| `services/runtime-broker/` | Worker connectivity, leases, and execution runtime |
| `services/knowledge-hub/` | Findings, Insights, and knowledge aggregation |
| `agents/worker-daemon/` | Local worker runtime |
| `infra/compose/` | Local platform dependencies: Postgres, NATS, MinIO, Keycloak |

## Legacy Archive

These documents describe the retired Adaptive Flywheel / `ring` architecture. They are retained for historical context and migration reference only. They do not define the current platform.

| Document | Historical Role |
|---|---|
| [docs/archive/legacy-adaptive-flywheel/README.md](./docs/archive/legacy-adaptive-flywheel/README.md) | Archive index for the retired Adaptive Flywheel / `ring` system |
| [docs/archive/legacy-adaptive-flywheel/docs/core-logic.md](./docs/archive/legacy-adaptive-flywheel/docs/core-logic.md) | Legacy product model: puzzle / execution / iteration |
| [docs/archive/legacy-adaptive-flywheel/docs/sessions/sessions.md](./docs/archive/legacy-adaptive-flywheel/docs/sessions/sessions.md) | Legacy `session_id` conventions |
| [docs/archive/legacy-adaptive-flywheel/docs/product/adaptive-flywheel.md](./docs/archive/legacy-adaptive-flywheel/docs/product/adaptive-flywheel.md) | Legacy product cross-reference note |
| [docs/archive/legacy-adaptive-flywheel/prototype/Adaptive-Flywheel.md](./docs/archive/legacy-adaptive-flywheel/prototype/Adaptive-Flywheel.md) | Original document-tree and concept prototype |
| [docs/archive/legacy-adaptive-flywheel/ring/API.md](./docs/archive/legacy-adaptive-flywheel/ring/API.md) | Legacy Node/REST protocol documentation |
| `.ring/` | Legacy JSON state tree |
| `ring/` | Legacy protocol implementation |
| `ring-gui/` | Legacy frontend implementation |
| `cli-tool/` | Legacy document-generation tooling |
