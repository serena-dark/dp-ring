# Platform Value and Principles

`dp-ring v2` is a multi-tenant control plane for human-and-agent software delivery. It treats planning, execution, review, findings, and operational insight as first-class platform resources instead of file-based artifacts scattered across ad hoc workflows.

## Core Goal

The platform exists to make agent delivery auditable, steerable, and reusable at the organization and workspace level.

It does that by giving operators one control surface for:

- submitting and triaging delivery objectives
- decomposing work into explicit executable units
- leasing execution to local workers
- reviewing outcomes with clear status transitions
- turning incidents and repeated patterns into findings and insights

## Product Model

The current platform is organized around these domain resources:

- `Organization`
- `Workspace`
- `Repository`
- `Objective`
- `Blueprint`
- `WorkItem`
- `Execution`
- `Review`
- `Finding`
- `Insight`
- `Worker`

These resources are served by the Rust control plane and surfaced in the TypeScript operator console. The retired `requirement / session / task / workflow` vocabulary is historical context only.

## Design Principles

- **Control plane first**: the live platform is the source of truth, not a repo-local JSON tree.
- **Explicit boundaries**: `control-api`, `orchestrator`, `runtime-broker`, `knowledge-hub`, and `worker-daemon` own separate responsibilities.
- **Event-driven coordination**: cross-service state propagation happens through contracts and events, not hidden in-process mutation.
- **Typed contracts**: public HTTP and internal gRPC/event schemas are versioned under `contracts/`.
- **Multi-tenant by default**: organization, workspace, repository, and RBAC are foundational, not optional extensions.
- **Operator visibility**: the system must expose live queue, run, review, worker, and activity views for intervention.
- **Archive legacy, do not inherit it implicitly**: old `ring` and Adaptive Flywheel material can inform history, but it does not govern current behavior.

## Active References

- Project entry: [README.md](./README.md)
- Document index: [INDEX.md](./INDEX.md)
- Current architecture: [docs/v2/ARCHITECTURE.md](./docs/v2/ARCHITECTURE.md)
- Current repository structure: [docs/repository-layout.md](./docs/repository-layout.md)
- Public HTTP contract: [contracts/openapi/openapi.yaml](./contracts/openapi/openapi.yaml)
