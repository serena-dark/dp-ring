# Core Value and Goals

dp-ring implements an **Adaptive Flywheel** for agent development workflows: a system where each execution session is measured, its knowledge distilled, and its workflows ranked — so the next session starts from a better position.

## The Three Phases

1. **Puzzle Phase** — Transforms raw requirements into gate-controllable milestones with machine-evaluable prerequisites. Operates asynchronously, independent of execution.

2. **Execution Phase** — Once gates pass, executes tasks through reusable workflow templates. Every step is tracked in a session record with a proper state machine.

3. **Closure Protocol** — After each session (success or failure): evaluate quality across five dimensions, distill knowledge into structured artifacts, update the workflow leaderboard. This is the mechanism that makes the flywheel turn.

## Evolution Mechanism

The flywheel turns through four forces:

- **Variation** — Reusable workflow templates that can be applied to different tasks.
- **Evaluation** — Five-dimension quality scoring (correctness, completeness, efficiency, adherence, reusability).
- **Selection** — A leaderboard ranks workflows by score per task type. Better workflows get more usage.
- **Inheritance** — Distilled knowledge (lessons, patterns, anti-patterns) is injected as context into future sessions.

## Design Principles

- **Schema-first**: Every artifact is a JSON file validated against a JSON Schema. Prose docs are views, not source of truth.
- **State machines are explicit**: All lifecycle transitions are defined in schemas and enforced by the protocol library.
- **Machine-readable first**: Agents read JSON, not markdown. The `.ring/` directory is the interface.
- **Repo as source, DB as cache**: Git-tracked JSON files are authoritative. An optional service can index them.

## Related Documents

- Document index: [INDEX.md](./INDEX.md)
- Core logic (legacy): [docs/core-logic.md](./docs/core-logic.md)
- API documentation: [ring/API.md](./ring/API.md)
- Frontend plan: [ring-gui/TODOS.md](./ring-gui/TODOS.md)
- Schemas: `.ring/schemas/`
