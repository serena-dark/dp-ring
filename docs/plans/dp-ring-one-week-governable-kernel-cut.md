# dp-ring One-Week Governable Kernel Cut Plan

> For Hermes: this is a compressed seven-day cutline for getting dp-ring to a functionally governable Phase 1 kernel. Stay inside `ring/lib/`, `.ring/schemas/`, and `tests/ring/` unless a blocker proves otherwise.

Goal: within 7 days, ship a dp-ring kernel that can not only record lineage, but also use typed publication + validation artifacts to actually allow, block, replay, and reuse work under governance.

Architecture: keep the existing tree-first runtime and do not open new fronts. Build on the landed checkpoint tree, branch-event commit statements, publication statements, and branch metrics. The missing step is to turn those artifacts into a compact package/root shell plus a validation report/result family that runtime policy actually consumes.

Tech stack: Node runtime under `ring/`, JSON Schema under `.ring/schemas/`, Ajv validation, existing orchestrator/session-runner/task-execution paths, node test runner, eslint, full `npm test` regression suite.

Non-goals for this 7-day cut:
- no UI/operator-web feature work
- no Rust control-plane work
- no broad RAG ecology expansion
- no generalized argumentation engine yet
- no full acceptance-logic theory; only the minimum governance states needed to enforce decisions

Definition of done for the one-week cut:
1. checkpoints and branch-events are grouped into publication/decision roots rather than only flat member statements
2. validation is no longer just `{ valid, errors }`; there is a durable validation report/result family
3. runtime policy consumes those artifacts to gate at least:
   - checkpoint continuation/adoption
   - workflow reuse / reuse blocking
   - timeout replay / terminalization
4. there is at least one verifier-style node path, not only `workflow-run-executor`
5. one end-to-end regression demonstrates a governed flow where execution produces artifacts, verification produces a validation report, and policy changes the runtime decision

---

## Day 1 — Publication root shell

Objective: add the package/root shell that groups already-landed statements into replayable publication units.

Files:
- Create: `.ring/schemas/governance-publication-root.schema.json`
- Modify: `.ring/schemas/checkpoint.schema.json`
- Modify: `.ring/schemas/branch-event.schema.json`
- Modify: `ring/lib/governance-statement.mjs`
- Test: `tests/ring/governance-statement.test.mjs`
- Test: `tests/ring/validator.test.mjs`

Required slice:
- introduce a root artifact for one publication cycle with:
  - root id / profile / status
  - about-subject descriptor
  - member statement refs or inline members
  - bundle digest / membership digest
- make checkpoint publication and branch commit statements project cleanly into that root
- keep it small: one checkpoint publication root and one branch decision root shape are enough for the week-1 cut

Verification:
- `node --test tests/ring/governance-statement.test.mjs tests/ring/validator.test.mjs`

Commit:
- `feat: add governance publication root shell`

## Day 2 — Validation report/result family

Objective: replace raw validator output as the only durable validation surface.

Files:
- Create: `.ring/schemas/governance-validation-report.schema.json`
- Modify: `ring/lib/validator.mjs`
- Modify: `ring/lib/governance-statement.mjs`
- Test: `tests/ring/validator.test.mjs`
- Test: `tests/ring/governance-statement.test.mjs`

Required slice:
- add a validation report artifact with:
  - report id / subject descriptor / validator profile
  - invocation metadata
  - results array
- each result should include at least:
  - `rule_id`
  - `level`
  - `message`
  - `location`
  - `baseline_state` (`new | unchanged | updated | absent`)
- keep Ajv underneath, but normalize its raw errors into the new result shape
- preserve the old boolean API as a convenience wrapper if needed, but make the report/result family the new durable shell

Verification:
- `node --test tests/ring/validator.test.mjs`

Commit:
- `feat: add governance validation report artifacts`

## Day 3 — Thread publication + validation through runtime

Objective: make real workflow lineage emit these artifacts, not just helper-level tests.

Files:
- Modify: `ring/lib/session-runner.mjs`
- Modify: `ring/lib/checkpoint-tree.mjs`
- Modify: `tests/ring/session-runner.test.mjs`
- Modify: `tests/ring/checkpoint-tree.test.mjs`
- Modify: `tests/ring/store.test.mjs`

Required slice:
- when root checkpoints or continued/synthesized checkpoints are written, also write or update:
  - publication root
  - publication statements
- when branch events are appended, ensure they can join a decision root
- when validator output is available, persist a validation report instead of dropping back to `{ valid, errors }`

Verification:
- `node --test tests/ring/session-runner.test.mjs tests/ring/checkpoint-tree.test.mjs tests/ring/store.test.mjs`

Commit:
- `feat: persist publication and validation artifacts through session lineage`

## Day 4 — Make policy consume the new artifacts

Objective: move from recording artifacts to using them for governance.

Files:
- Modify: `ring/lib/governance-policy.mjs`
- Modify: `ring/lib/orchestrator.mjs`
- Modify: `ring/lib/task-execution.mjs`
- Modify: `ring/lib/session-runner.mjs`
- Test: `tests/ring/governance-policy.test.mjs`
- Test: `tests/ring/orchestrator.test.mjs`
- Test: `tests/ring/task-execution.test.mjs`
- Test: `tests/ring/session-runner.test.mjs`

Required slice:
- add one shared helper that evaluates whether a publication root + validation report allows:
  - continue
  - adopt
  - reuse
  - replay
  - terminalize
- do not invent a full declarative language yet; use a compact allow/block/escalate policy table
- require at least one real runtime decision to depend on validation severity, not just branch budget and lineage history

Verification:
- `node --test tests/ring/governance-policy.test.mjs tests/ring/orchestrator.test.mjs tests/ring/task-execution.test.mjs tests/ring/session-runner.test.mjs`

Commit:
- `feat: gate runtime decisions on publication and validation artifacts`

## Day 5 — Add a verifier node profile

Objective: prove the kernel is not just one executor node with richer metadata.

Files:
- Modify: `.ring/schemas/node.schema.json`
- Modify: `ring/lib/node-contract.mjs`
- Modify: `ring/lib/session-runner.mjs`
- Modify: `ring/lib/orchestrator.mjs`
- Test: `tests/ring/node-contract.test.mjs`
- Test: `tests/ring/session-runner.test.mjs`
- Test: `tests/ring/orchestrator.test.mjs`

Required slice:
- add one second concrete node profile, minimally:
  - `workflow-run-verifier`
- keep its local implementation simple, but ensure the outer contract differs from executor
- have the runtime use it to emit or own the validation report path

Verification:
- `node --test tests/ring/node-contract.test.mjs tests/ring/session-runner.test.mjs tests/ring/orchestrator.test.mjs`

Commit:
- `feat: add verifier node profile to the governance kernel`

## Day 6 — End-to-end governed flow

Objective: prove the framework can now actually exercise governance.

Files:
- Modify: `tests/ring/orchestrator.test.mjs`
- Modify: `tests/ring/session-runner.test.mjs`
- Modify: `tests/ring/task-execution.test.mjs`
- Modify: `tests/ring/loopback-runtime.test.mjs`

Required slice:
- add one end-to-end regression where:
  1. executor node creates checkpoint/publication artifacts
  2. verifier node emits a validation report
  3. policy blocks or escalates one path
  4. runtime changes a real decision because of it
- acceptable decisions for the demo path:
  - block adoption
  - force replay
  - prohibit automatic reuse
  - terminalize a timed-out governed branch

Verification:
- `node --test tests/ring/orchestrator.test.mjs tests/ring/session-runner.test.mjs tests/ring/task-execution.test.mjs tests/ring/loopback-runtime.test.mjs`

Commit:
- `test: cover end-to-end governed kernel flow`

## Day 7 — Hardening and cut release

Objective: clean, verify, and freeze the one-week cut.

Files:
- Modify only what regression or review proves necessary
- Optional docs note under `docs/plans/` summarizing what landed and what was deferred

Required slice:
- run the full regression suite repeatedly until green
- fix any schema drift, runtime persistence gaps, or flaky test assumptions
- produce a short “week-1 cut achieved / not achieved” report

Verification:
- `./node_modules/.bin/eslint ring/lib/*.mjs tests/ring/*.mjs`
- `git diff --check`
- `npm test`

Commit:
- `chore: stabilize one-week governable kernel cut`

---

## Cutline realism

This one-week target is realistic only if scope is held to:
- Phase 1 governance kernel only
- one publication-root family
- one validation report/result family
- one verifier node profile
- one end-to-end governed flow

This target becomes unrealistic if the week expands into:
- UI/operator surfaces
- full argumentation semantics
- broad multi-node ecology
- Rust projection
- generalized productization

## Minimum acceptable outcome after 7 days

If the full cut slips, the minimum acceptable week-1 outcome is:
- publication roots exist
- validation reports exist
- one runtime decision is artifact-driven
- full `npm test` still passes

Anything less means the week did not actually cross the line from “recording governance” to “exercising governance.”
