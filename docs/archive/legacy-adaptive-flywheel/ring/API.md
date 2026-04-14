# Ring REST API

> Archived: This API belongs to the retired `ring` runtime. It is retained for historical reference only. The current platform contract lives under [contracts/openapi/openapi.yaml](../../../../contracts/openapi/openapi.yaml).

HTTP interface served by `ring/server.mjs`. Default port `3100`.

During frontend development, Vite proxies `/api/*` to `http://localhost:3100` (see `vite.config.ts`).

All request/response bodies are JSON. All responses follow:

```jsonc
// Success
{ "ok": true, "data": <payload> }

// Error
{ "ok": false, "error": "<message>", "details": <optional> }
```

---

## Artifact CRUD

Every artifact type (`requirement`, `milestone`, `task`, `workflow`, `workflow-run`, `session`, `evaluation`, `feedback`, `distillation`) supports the same CRUD pattern:

### List — `GET /api/<type>[?status=<filter>]`

Returns all artifacts of that type. Optional `status` query parameter filters by status.

### Read — `GET /api/<type>/<id>`

Returns a single artifact by ID. 404 if not found.

### Create — `POST /api/<type>`

Body:
```jsonc
{
  "name": "Human-readable name",       // required (used for ID generation)
  "status": "draft",                    // optional (defaults by type)
  "created_by": "agent-id",            // optional (defaults to "ring-gui")
  "session_id": "s1-...",              // optional
  "parent_id": "r1-...",              // optional (for milestone: requirement id)
  "data": { /* type-specific */ }      // required
}
```

Returns `201` with the created artifact. `400` if validation fails.

### Update — `PATCH /api/<type>/<id>`

Body:
```jsonc
{
  "status": "new-status",              // optional (state machine enforced)
  "data": { /* fields to merge */ }    // optional
}
```

Returns `200` with the updated artifact. `400` if state transition is invalid or validation fails.

### Task contract

New task artifacts can carry a stricter execution contract in `data.scope` and `data.execution`:

- `scope.target_type`: `project` / `module` / `file`
- `scope.target_path`: repo-relative target path
- `scope.repo_root`: repo-relative git working root
- `scope.file_paths`: exact file list that the task is allowed to touch
- `execution.build_required` / `execution.build_command`
- `execution.cleanup_paths`
- `execution.review_status`: scope/build/judge lifecycle
- `replanning.status`: failed-task replanner lifecycle

For tasks with an execution contract, direct `completed` transitions are blocked until the judge agent approves them.

---

## Session Context — `GET /api/session/<id>/context`

Returns the full startup context bundle for an agent:
```jsonc
{
  "session": { ... },
  "tasks": [ ... ],
  "workflow_runs": [ ... ],
  "workflow_templates": [ ... ],
  "knowledge": [ { "summary": "...", "confidence": 0.9, ... } ],
  "blocking_feedback": { "critical": [], "major": [] }
}
```

Adaptive sessions now also have a session runner. Once a batch launch creates a
live session, the runner prepares each `workflow-run` by writing an execution
packet under `.ring/orchestrator/runner/sessions/<session-id>/`, injecting the
staged material mounts, issuing a signed callback contract, and moving the
session from `preparing` to `executing`.

### Workflow workers — `GET /api/orchestrator/workers`

Returns the worker identity registry used by the session runner. Each worker
card declares which callback protocols it may use and whether it is currently
active. `workflow-run` callbacks are accepted only from registered active
workers.

### Service stack status — `GET /api/runtime/services`

Returns the managed service stack state used by `npm run stack:start`, plus
live probes for:

- backend API health
- frontend preview health
- frontend `/api` proxy health

The payload also includes the managed backend/frontend PIDs and the current log
file paths under `.ring/runtime/`.

---

## OpenAI Gateway

The backend now exposes a single OpenAI integration surface so every
agent-capable entry point can reuse the same cloud connection instead of
hard-coding provider calls in multiple places.

Environment variables:

- `OPENAI_API_KEY` optional API-key fallback for server-to-server calls
- `OPENAI_OAUTH_CLIENT_ID`
- `OPENAI_OAUTH_CLIENT_SECRET`
- `OPENAI_OAUTH_REDIRECT_URI`
- `OPENAI_OAUTH_SCOPES` optional, defaults to `openid profile email offline_access`
- `OPENAI_OAUTH_AUDIENCE` optional, defaults to `https://api.openai.com/v1`
- `OPENAI_RESPONSES_MODEL` optional, defaults to `gpt-5.4-mini`

Sensitive OAuth session material is stored locally at
`.ring/runtime/openai-session.local.json`.

### Gateway status — `GET /api/openai`

Returns discovery metadata, OAuth configuration status, active session summary,
and which auth mode the backend will currently use (`oauth`, `api_key`, or
`none`).

### Start managed OAuth redirect — `POST /api/openai/oauth/start`

Starts the interactive browser OAuth flow used by the Settings page. The
backend generates and stores the `state` / PKCE verifier locally, then returns
an authorize URL that the frontend can open directly.

Body:

```jsonc
{
  "prompt": "consent"
}
```

### Complete managed OAuth redirect — `POST /api/openai/oauth/complete`

Completes the interactive browser OAuth flow after OpenAI redirects back to the
configured `OPENAI_OAUTH_REDIRECT_URI`. The frontend only forwards the returned
`code` and `state`; the backend loads the stored verifier and performs the
token exchange.

Body:

```jsonc
{
  "code": "<oauth-code>",
  "state": "<oauth-state>"
}
```

### Build authorize URL — `POST /api/openai/authorize-url`

Builds the OpenAI OAuth authorize URL on the server so the frontend can start
the redirect flow without exposing client secrets.

Body:

```jsonc
{
  "state": "csrf-state",
  "redirect_uri": "http://localhost:5173/settings",
  "code_challenge": "<pkce-challenge>",
  "code_challenge_method": "S256",
  "prompt": "consent"
}
```

### Exchange token — `POST /api/openai/token`

Exchanges an authorization code or refresh token and persists the resulting
session locally.

Authorization code body:

```jsonc
{
  "grant_type": "authorization_code",
  "code": "<oauth-code>",
  "redirect_uri": "http://localhost:5173/settings",
  "code_verifier": "<pkce-verifier>"
}
```

Refresh body:

```jsonc
{
  "grant_type": "refresh_token",
  "refresh_token": "<refresh-token>"
}
```

### Refresh the current session — `POST /api/openai/refresh`

Uses the stored refresh token, if present, to rotate the local session.

### Disconnect — `DELETE /api/openai/session`

Revokes the locally stored OpenAI session when possible and deletes the local
session file.

### Direct Responses proxy — `POST /api/openai/responses`

Calls the OpenAI Responses API through the backend using the active OAuth
session first, then `OPENAI_API_KEY` as a fallback.

Body:

```jsonc
{
  "model": "gpt-5.4-mini",
  "instructions": "You are the dp-ring planner.",
  "input": "Plan the next action.",
  "reasoning": {
    "effort": "medium"
  }
}
```

### Workflow-run worker report — `POST /api/workflow-run/<id>/report`

Lets an external workflow worker report progress or completion back to the
session runner.

Authentication and signing:

- `Authorization: Bearer <callback-token>`
- `X-Ring-Timestamp: <ISO-8601 timestamp>`
- `X-Ring-Signature: sha256=<hmac-hex>`
- `X-Ring-Key-Version: <integer>` optional but recommended after callback key rotation
- `X-Ring-Worker-Id: <worker-id>` optional when the payload already carries worker identity

The HMAC input is `<timestamp>.<raw-json-body>`. The token and secret are
delivered in the execution packet under `callbacks.workflow_run_report`. On each
retry the session runner rotates the callback token and signing secret, bumps
`key_version`, and rewrites the execution packet in place.

Body:

```jsonc
{
  "status": "completed", // "progress" | "completed" | "failed"
  "step_id": "s2",       // optional; defaults to current_step_index
  "actor": "worker-agent",
  "note": "Execution finished.",
  "commit_sha": "abc1234", // optional; on completed, triggers task finalization
  "outputs": {
    "artifact_path": "dist/out.txt"
  }
}
```

A2A-style envelope is also accepted and normalized into the same internal
states:

```jsonc
{
  "protocol": "a2a.task-status.v1",
  "worker": {
    "id": "a2a-worker",
    "display_name": "A2A Bridge Worker"
  },
  "task": {
    "id": "run-123",
    "kind": "workflow-run",
    "status": {
      "state": "completed",
      "message": "Execution finished."
    },
    "artifacts": [
      { "kind": "git_commit", "uri": "git+commit://abc1234" }
    ],
    "metadata": {
      "step_id": "s2",
      "judge_agent_id": "task-judge",
      "outputs": {
        "artifact_path": "dist/out.txt"
      }
    }
  }
}
```

Effects:

- `progress` updates the current workflow step outputs / notes
- `completed` advances the workflow run; when `commit_sha` is present, the
  session runner calls task finalization automatically and hands the task to the
  judge packet flow
- `failed` marks the workflow run as failed and automatically routes the task
  into failure distillation + replanning
- callbacks from unknown workers or unsupported callback protocols are rejected
- unsigned / expired / invalid callback signatures are rejected with `401`
- if no signed callback arrives before `session_runner.report_timeout_ms`, the
  runner schedules retries; once `session_runner.max_report_retries` is
  exhausted, the workflow run times out and the task is automatically routed
  into failure distillation + replanning

---

## Task Finalization

Tasks are now treated as the smallest independently executable operation. A task binds:

- one project / module / file scope
- one git repository root
- one exact file list
- one workflow

### Finalize a task — `POST /api/task/<id>/finalize`

Runs the task completion pipeline:

1. read the task's bound file scope
2. inspect the provided git commit
3. fail immediately if changed files do not exactly match the declared file list
4. run the task build command when required
5. clean task-local garbage paths
6. write a completion summary
7. dispatch a review packet to the task judge agent

Body:

```jsonc
{
  "commit_sha": "abc1234",
  "judge_agent_id": "task-judge",
  "note": "Optional operator note"
}
```

Possible outcomes:

- task remains `in_progress` with `data.execution.review_status = "awaiting_judgement"`
- task becomes `failed` with `scope_failed`, `build_failed`, or `cleanup_failed`
- failure automatically emits dedicated `feedback` + `distillation` artifacts
- failed tasks also move to `data.replanning.status = "awaiting_replan"` and dispatch a packet to the task replanner agent

### Judge a finalized task — `POST /api/task/<id>/judge`

Lets the task judge agent decide whether the task is truly successful.

Body:

```jsonc
{
  "verdict": "approved", // or "rejected"
  "judge_agent_id": "task-judge",
  "note": "Ready to merge"
}
```

Effects:

- `approved` -> task becomes `completed`, acceptance criteria are marked satisfied, merge becomes ready, and a success distillation is emitted
- `rejected` -> task becomes `failed`, failure feedback/distillation are emitted, and the task enters replanning

### Replan a failed task — `POST /api/task/<id>/replan`

Lets the dedicated task replanner decide whether a failed task should be turned into a new smallest executable task.

Body:

```jsonc
{
  "verdict": "redispatch", // or "terminal"
  "replanner_agent_id": "task-replanner",
  "note": "Narrow the scope to the actual changed file",
  "task": {
    "name": "Retry foo task",
    "target_type": "file",
    "target_path": "src/foo.ts",
    "repo_root": ".",
    "file_paths": ["src/foo.ts"],
    "build_command": "npm run build",
    "cleanup_paths": ["tmp/foo"],
    "workflow_template_id": "wf-feature",
    "execution_mode": "serial",
    "acceptance_criteria": [
      { "description": "Only touches src/foo.ts" }
    ]
  }
}
```

Effects:

- `terminal` -> the failed task remains failed and is marked `data.replanning.status = "terminal"`
- `redispatch` -> the failed task remains failed but is marked `data.replanning.status = "redispatched"`, and a successor task is created with `data.replanning.parent_task_id` pointing back to the failed task

---

## Registry / Leaderboard

### Full leaderboard — `GET /api/registry/leaderboard`

Returns the entire leaderboard with all task type rankings.

### Rankings for a task type — `GET /api/registry/rank/<task-type>`

Returns the ranked workflow list for a specific task type (sorted by avg_score descending).

---

## Gate Evaluation — `GET /api/gate/<milestone-id>`

Runs programmatic gate evaluation on a milestone's prerequisites and checks blocking feedback.

Returns:
```jsonc
{
  "passed": true,
  "results": [ { "id": "pre-1", "satisfied": true, "detail": "..." } ],
  "blocking_feedback": { "critical": [], "major_unacknowledged": [] }
}
```

---

## Knowledge Query — `GET /api/knowledge/<task-type>[?min_confidence=0.3]`

Returns relevant distilled knowledge items for a task type, sorted by confidence descending.

---

## Orchestrator / Dispatch Center

The orchestrator is a scheduler-backed control plane for a five-stage pipeline:

1. requirement document drafting + audit
2. milestone planning document drafting + milestone materialization
3. prerequisite readiness routing + adaptive bundle handoff
4. adaptive dispatcher task planning + workflow preparation
5. waiting-area batch launch into a single session

State machine:

`queued -> requirement_dispatched -> requirement_document_in_progress -> requirement_ready_for_audit -> requirement_auditing -> milestone_dispatched -> milestone_document_in_progress -> milestone_ready_for_finalize -> milestones_ready -> post_milestone_dispatched -> post_milestone_in_progress -> workflow_dispatched -> workflow_in_progress -> waiting_for_session_dispatch -> session_dispatched`

Failure / rework branches:

- `requirement_auditing -> requirement_rework_required -> requirement_dispatched`
- `milestone_ready_for_finalize -> milestone_rework_required -> milestone_dispatched`
- `post_milestone_in_progress -> post_milestone_rework_required -> post_milestone_dispatched`
- `workflow_in_progress -> workflow_rework_required -> workflow_dispatched`
- any active dispatch / drafting stage can move to `failed`

The server polls every **30 seconds**. A document is considered complete when either:

- the active agent reports completion, or
- the document has stopped changing for `document_idle_threshold_ms`

The control plane now adds three production-style layers on top of the stage machine:

- **Agent cards**: every orchestrated role publishes a capability card with accepted intents, produced artifacts, and callback contract
- **Message envelopes**: dispatch packets now carry `protocol_version`, `trace_id`, callback metadata, artifact references, and routing context
- **Trace / intervention / routing**: each job records spans, open interventions, and a routing policy that can choose serial vs parallel readiness gating and how strict workflow reuse should be

### Config — `GET /api/orchestrator/config`

Returns scheduler config:

```jsonc
{
  "schema_version": 4,
  "message_protocol_version": "ring.orchestrator.v1",
  "poll_interval_ms": 30000,
  "document_idle_threshold_ms": 120000,
  "writer_agent_id": "writer-agent",
  "auditor_agent_id": "auditor",
  "milestone_planner_agent_id": "milestone-planner",
  "prerequisite_preparer_agent_id": "prerequisite-preparer",
  "task_dispatcher_agent_id": "task-dispatcher",
  "workflow_designer_agent_id": "workflow-architect",
  "task_judge_agent_id": "task-judge",
  "distiller_agent_id": "distiller",
  "document_output_dir": "docs/generated",
  "milestone_output_dir": "docs/milestones",
  "prerequisite_output_dir": "docs/prerequisites",
  "task_dispatch_output_dir": "docs/tasks/plans",
  "workflow_output_dir": "docs/workflows/plans",
  "task_summary_output_dir": "docs/tasks/reviews",
  "followup_output_dir": "docs/followups",
  "session_runner": {
    "report_timeout_ms": 120000,
    "max_report_retries": 2,
    "retry_backoff_ms": 30000,
    "signature_ttl_ms": 300000
  },
  "auditor": { "min_character_count": 240, "...": true }
}
```

### Agent registry — `GET /api/orchestrator/agents`

Returns the current orchestrator agent cards.

Example item:

```jsonc
{
  "id": "writer-agent",
  "display_name": "Requirement Writer",
  "role": "writer",
  "description": "Turns a requirement into an auditable requirement document.",
  "accepts": ["requirement_to_document"],
  "produces": ["requirement_document"],
  "capability_tags": ["writing", "requirements", "handoff"],
  "callback_endpoint": "/api/orchestrator/jobs/:job_id/agent-report"
}
```

### Update config — `PATCH /api/orchestrator/config`

Body:

```jsonc
{
  "document_idle_threshold_ms": 180000
}
```

### Create requirement + dispatch job — `POST /api/orchestrator/requirements`

Creates a normal `requirement` artifact, generates all orchestrator document paths, computes a routing policy, creates the writer-agent packet, and moves the requirement into `analyzing`.

Body:

```jsonc
{
  "name": "Requirement name",
  "description": "What should become a document",
  "priority": "high",
  "acceptance_criteria": [
    { "id": "ac1", "description": "Document is clear", "satisfied": false }
  ],
  "created_by": "ring-gui"
}
```

### List jobs — `GET /api/orchestrator/jobs`

Returns all orchestrator jobs.

### Read job — `GET /api/orchestrator/jobs/<job-id>`

Returns one orchestrator job, including current stage, requirement document state, milestone planning state, prerequisite analysis state, task dispatch state, audit result, generated milestone/task ids, distillation feedback ids, and history.
It also includes workflow preparation state, waiting-area task readiness, launched session/workflow-run ids, routing policy, trace spans, and intervention state.

Important job fields:

- `routing.mode`: `lean` / `balanced` / `deep`
- `routing.post_milestone_strategy`: `parallel` or `serial`
- `routing.workflow_strategy`: `reuse_strict` / `reuse_first` / `hybrid`
- `trace.trace_id`: shared correlation id for all packets and spans
- `trace.spans[]`: dispatch / audit / planning spans with status and timestamps
- `interventions[]`: open or resolved human-in-the-loop items created by parse failures, audit failures, or agent failures
- `followup`: distiller follow-up loop state, source intervention ids, brief document, and any generated requirement/job ids

### Agent report — `POST /api/orchestrator/jobs/<job-id>/agent-report`

Agent feedback. A `completed` report immediately routes the current phase forward:

- requirement writer -> Auditor review
- milestone planner -> milestone materialization
- prerequisite preparer -> prerequisite parsing + distillation -> feedback
- task dispatcher -> task parsing + task artifact materialization
- workflow architect -> workflow reuse/custom materialization -> waiting area

Body:

```jsonc
{
  "agent_id": "writer-agent", // or "milestone-planner" / "prerequisite-preparer" / "task-dispatcher" / "workflow-architect"
  "status": "completed", // "in_progress" | "completed" | "failed"
  "note": "Draft complete"
}
```

When a packet exists, it now contains an envelope like:

```jsonc
{
  "id": "pkt-job-0001-requirement",
  "protocol_version": "ring.orchestrator.v1",
  "trace_id": "trace-job-0001",
  "sender": { "id": "dispatch-center", "role": "orchestrator" },
  "recipient": "writer-agent",
  "recipient_card": { "...": "agent card fields" },
  "callback": {
    "kind": "orchestrator_agent_report",
    "method": "POST",
    "path": "/api/orchestrator/jobs/job-0001/agent-report"
  },
  "artifacts": [
    { "kind": "requirement", "id": "r1-foo", "path": null, "role": "source" },
    { "kind": "requirement_document", "id": null, "path": "docs/generated/r1-foo.md", "role": "target" }
  ],
  "routing": {
    "mode": "balanced",
    "post_milestone_strategy": "parallel",
    "workflow_strategy": "reuse_first"
  }
}
```

### Retry a job — `POST /api/orchestrator/jobs/<job-id>/retry`

Re-dispatches a failed / rework job and sends a fresh packet.

### Update interventions — `POST /api/orchestrator/jobs/<job-id>/interventions`

Creates or resolves a human-in-the-loop intervention item.

Resolve:

```jsonc
{
  "action": "resolve",
  "intervention_id": "int-job-0001-0002",
  "note": "Resolved by operator.",
  "actor": "operator"
}
```

### Draft a follow-up brief — `POST /api/orchestrator/jobs/<job-id>/followup/dispatch`

Creates or refreshes a distiller follow-up brief from the selected interventions.

Body:

```jsonc
{
  "intervention_ids": ["int-job-0001-0001"], // optional, defaults to open interventions
  "note": "Create a follow-up brief for this failure cluster."
}

---

## Adaptive Dispatcher Bundles

The dispatcher now accepts protocol-tagged bundles and normalizes them into a
single canonical execution goal shape before task planning and session launch.

Supported protocols:

- `ring.goal.v1`
- `a2a.task+artifacts@2025.1`
- `mcp.resource-set@2025-06-18`

Supported artifact transports:

- `https`
- `oci-distribution@1.1`
- `inline`

Envelope:

```jsonc
{
  "bundle_protocol": "a2a.task+artifacts",
  "bundle_version": "2025.1",
  "artifact_transport": "oci-distribution@1.1",
  "payload": {},
  "attachments": [],
  "submitted_by": "external-device-x"
}
```

Canonical bundle:

```jsonc
{
  "schema_version": "execution.goal.v1",
  "goal_bundle_id": "db-0001",
  "goal": {
    "goal_id": "goal-db-0001",
    "title": "Deliver feature X",
    "description": "What must be achieved",
    "acceptance_criteria": ["tests pass", "docs updated"]
  },
  "environment": {
    "project_id": "project-a",
    "repo_root": "/repo",
    "target_scope": {
      "level": "file",
      "include_paths": ["src/app.ts"],
      "exclude_paths": []
    }
  },
  "materials": [
    {
      "material_id": "mat-1",
      "kind": "preparation_package",
      "uri": "https://example.com/prep.zip",
      "format": "zip",
      "checksum": "sha256:abc123"
    }
  ]
}
```

Bundle state machine:

`bundle_received -> bundle_normalized -> bundle_validated -> materials_staged -> task_planning -> workflow_resolving -> ready_queued -> session_batched -> session_launched`

Failure states:

- `validation_failed`
- `material_stage_failed`
- `task_planning_failed`
- `workflow_resolution_failed`
- `launch_failed`

### List supported protocols — `GET /api/dispatch/protocols`

Returns the protocol matrix, bundle versions, required fields, and supported
artifact transports.

### Submit a bundle — `POST /api/dispatch/bundles`

Creates a dispatch bundle, chooses an adapter from `bundle_protocol` and
`bundle_version`, normalizes to `execution.goal.v1`, validates remote checksums,
downloads and stages remote materials, extracts zip packages into their mount
targets, plans tasks, resolves workflows, and queues the bundle for the next
session batch tick.

Rules:

- `ring.goal.v1` requires `goal + environment + materials`
- `a2a.task+artifacts` requires `task + artifacts`
- `mcp.resource-set` requires `goal + resources`
- remote transports (`https`, `oci-distribution@1.1`) require checksums
- `inline` is only for small metadata / brief payloads

### List bundles — `GET /api/dispatch/bundles`

Returns all adaptive dispatcher bundle records.

### Read one bundle — `GET /api/dispatch/bundles/<bundle-id>`

Returns one dispatch bundle, including canonical payload, staging state,
planned task ids, workflow assignments, batching state, error list, and
history.

Remote staging records include the mounted `resolved_path` and may also include
`download_path`, `extracted_path`, `source_path`, `manifest_uri`,
`verified_size_bytes`, and `checksum_verified`.

### Report bundle status — `POST /api/dispatch/bundles/<bundle-id>/report`

Appends an external report to the bundle timeline.

Body:

```jsonc
{
  "status": "completed",
  "note": "External device finished uploading bundle materials.",
  "source": "device-x"
}
```
```

Effects:

- creates a packet for the `distiller`
- writes `docs/followups/<requirement-id>.md` if missing
- records the selected source interventions on the source job

### Create a follow-up requirement — `POST /api/orchestrator/jobs/<job-id>/followup/create-requirement`

Parses the follow-up brief and creates a brand-new requirement plus orchestrator job.

Body:

```jsonc
{
  "created_by": "distiller"
}
```

Response:

```jsonc
{
  "source_job": { "...": "updated source job with followup.status = completed" },
  "followup_requirement": { "...": "new requirement artifact" },
  "followup_job": { "...": "new orchestrator job already dispatched to the writer" }
}
```

Create:

```jsonc
{
  "action": "create",
  "stage": "workflow_preparation",
  "severity": "warning",
  "reason": "Workflow plan needs clarification.",
  "recommendation": "Request an updated workflow assignment.",
  "note": "Manual intervention requested from dashboard.",
  "actor": "operator"
}
```

### Force auditor run — `POST /api/orchestrator/jobs/<job-id>/audit`

Runs the requirement-document Auditor immediately when the job is waiting for audit.

### Force one scheduler cycle — `POST /api/orchestrator/tick`

Runs one scheduler cycle immediately. This cycle can:

- detect idle documents
- finalize audits and milestone materialization
- parse readiness outputs, emit feedback, and hand completed preparation into the adaptive dispatcher
- respect routing policy when deciding whether bundle handoff can happen in parallel or must wait for prerequisite gating
- normalize supported bundle protocols, plan tasks, and resolve workflows
- batch-launch one waiting-area session, creating workflow-runs and attaching tasks
- run registered execution hooks, including the session runner that prepares and advances live workflow-runs

Runs one polling cycle on demand. Useful for manual debugging.
