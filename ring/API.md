# Ring REST API

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
