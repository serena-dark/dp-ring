# dp-ring v2 Architecture

dp-ring v2 is a fresh control-plane platform. The old `ring` runtime, JSON state
tree, and artifact-centric UI are no longer the design source.

## Topology

- `services/control-api`
  - REST + SSE gateway for the operator console.
  - Hosts read models, navigation metadata, and viewer bootstrap payloads.
- `services/orchestrator`
  - Owns Objective, Blueprint, WorkItem, and Review command flows.
- `services/runtime-broker`
  - Owns Execution leases, worker connectivity, artifact manifests, and timeout handling.
- `services/knowledge-hub`
  - Owns Findings and Insights.
- `agents/worker-daemon`
  - Local agent process that binds repositories to the platform.

## Contracts

- `contracts/openapi/openapi.yaml`
  - Public REST surface consumed by `apps/operator-web`.
- `contracts/proto/*.proto`
  - Internal gRPC and event message contracts between services and worker runtimes.

## Infrastructure

`infra/compose/docker-compose.yml` provisions:

- Postgres for write models and projections
- NATS JetStream for domain events
- MinIO for logs, artifacts, and launch specs
- Keycloak for OIDC and organization-scoped RBAC

## Current implementation state

This repository now contains:

- Rust workspace scaffolding for all planned services
- Shared platform domain types and seeded read-model data
- A functional `control-api` scaffold with REST collection routes and SSE activity feed
- A new React operator console under `apps/operator-web`

Current maturity notes:

- `services/control-api` is the most complete v2 Rust service today, but it currently serves seeded `demo_snapshot()` data from `crates/platform-types` instead of live database-backed projections.
- `services/orchestrator` and `services/knowledge-hub` still read from the same seeded snapshot and currently demonstrate ownership boundaries more than independent runtime behavior.
- `services/runtime-broker` validates the runtime service shape and health surface, but it is not yet wired into a full control-plane execution path.
- The managed Node-based stack at the repository root remains the practical integration surface while these Rust services are hardened.
- The root regression suite now compiles `services/control-api` with `cargo check -p control-api` whenever the Rust toolchain is available, so the most active v2 Rust surface is part of routine validation instead of remaining an unverified scaffold.
