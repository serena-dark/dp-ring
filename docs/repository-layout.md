# Repository Directory Structure

This document describes the active `dp-ring v2` repository layout. It is the current authority for where platform code, contracts, infrastructure, and living documentation belong. Legacy `ring` and Adaptive Flywheel material remains in the repository for reference, but it is not the active structure baseline.

## Active Top-Level Layout

| Path | Purpose |
|---|---|
| `apps/` | User-facing applications |
| `services/` | Rust control-plane services |
| `agents/` | Local worker runtimes and agent-side processes |
| `contracts/` | Public and internal API contracts |
| `crates/` | Shared Rust libraries used across services and agents |
| `infra/` | Local infrastructure definitions and deployment helpers |
| `docs/` | Current platform docs plus retained legacy material |
| `tests/` | Cross-service, contract, and app-level tests |
| `package.json` | Root JavaScript scripts, including operator-web bootstrap/build/typecheck shortcuts |
| `apps/operator-web/package-lock.json` | Locked frontend dependency graph for `npm run v2:web:install` |
| `Cargo.toml` | Rust workspace manifest |

## Applications

| Path | Purpose |
|---|---|
| `apps/operator-web/` | React + TypeScript operator console using TanStack Router and TanStack Query |

## Services

| Path | Purpose |
|---|---|
| `services/control-api/` | External REST + SSE gateway, read models, navigation metadata, bootstrap payloads |
| `services/orchestrator/` | Objective, Blueprint, WorkItem, and Review command-side flows |
| `services/runtime-broker/` | Execution runtime, worker sessions, leases, artifact manifests, timeouts |
| `services/knowledge-hub/` | Findings, Insights, and knowledge-side aggregation |

## Agents

| Path | Purpose |
|---|---|
| `agents/worker-daemon/` | Local worker process that registers repositories, accepts leases, executes launch specs, and reports progress |

## Shared Contracts and Libraries

| Path | Purpose |
|---|---|
| `contracts/openapi/` | Public HTTP contract consumed by the operator console |
| `contracts/proto/` | Internal gRPC and event schemas shared by services and worker runtimes |
| `crates/platform-types/` | Shared domain and read-model types |

## Infrastructure

| Path | Purpose |
|---|---|
| `infra/compose/` | Local platform dependencies such as Postgres, NATS JetStream, MinIO, and Keycloak |

## Documentation Layout

| Path | Purpose |
|---|---|
| `README.md` | Project introduction and quick start |
| `INDEX.md` | Current top-level document index |
| `VALUE.md` | Current platform value and principles |
| `docs/v2/` | Current architecture and platform design documents |
| `docs/archive/legacy-adaptive-flywheel/` | Migrated legacy Markdown archive for the retired Adaptive Flywheel / `ring` system |
| `docs/` other files | Current docs plus a small amount of historical material not yet worth relocating |

## Legacy Material Still Present

The following directories remain in the repository but should be treated as historical reference, not as the current architecture baseline:

| Path | Historical Role |
|---|---|
| `.ring/` | Legacy JSON state tree |
| `ring/` | Legacy Node protocol implementation |
| `ring-gui/` | Legacy artifact-centric frontend |
| `cli-tool/` | Legacy markdown generation and naming tooling |
| `prototype/` | Remaining original design artifacts such as drawio sources |
