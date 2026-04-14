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

The Rust toolchain is not installed in the current execution environment, so the
Rust services are scaffolded but not compiled in this turn.
