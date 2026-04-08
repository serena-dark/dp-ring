/**
 * Ring API client — typed HTTP client for the ring backend.
 *
 * All methods call the REST API served by ring/server.mjs (proxied via Vite in dev).
 * See ring-gui/types/api.ts for the full type contract.
 *
 * TODO: Implement all methods below. Each method currently throws "not implemented".
 *       The backend API is documented in ring/API.md and served by ring/server.mjs.
 *       During development, Vite proxies /api/* to http://localhost:3100.
 */

import type {
  ArtifactType,
  Envelope,
  Requirement,
  Milestone,
  Task,
  Workflow,
  WorkflowRun,
  Session,
  Evaluation,
  Feedback,
  Distillation,
  Leaderboard,
  GateResult,
  KnowledgeItem,
  SessionContext,
  ApiResponse,
} from "@ring-gui/types/api";

const BASE = "/api";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

// TODO: Implement these fetch helpers. They should:
//   1. Call fetch() with the correct URL, method, headers, and body.
//   2. Parse the JSON response.
//   3. Return the typed ApiResponse<T>.
//   4. Handle network errors gracefully (return ApiError, don't throw).

async function get<T>(path: string): Promise<ApiResponse<T>> {
  void path;
  throw new Error("TODO: implement get()");
}

async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  void path;
  void body;
  throw new Error("TODO: implement post()");
}

async function patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  void path;
  void body;
  throw new Error("TODO: implement patch()");
}

// ---------------------------------------------------------------------------
// Artifact CRUD
// ---------------------------------------------------------------------------

/** List all artifacts of a type. Optional status filter. */
export function listArtifacts<T = Envelope>(
  type: ArtifactType,
  status?: string,
): Promise<ApiResponse<T[]>> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return get(`${BASE}/${type}${qs}`);
}

/** Read a single artifact by type and id. */
export function readArtifact<T = Envelope>(
  type: ArtifactType,
  id: string,
): Promise<ApiResponse<T>> {
  return get(`${BASE}/${type}/${encodeURIComponent(id)}`);
}

/** Create a new artifact. Server generates id if not provided. */
export function createArtifact<T = Envelope>(
  type: ArtifactType,
  fields: { name: string; status?: string; data?: Record<string, unknown> },
): Promise<ApiResponse<T>> {
  return post(`${BASE}/${type}`, fields);
}

/** Update an artifact (status transition, data patch, or both). */
export function updateArtifact<T = Envelope>(
  type: ArtifactType,
  id: string,
  patch_body: { status?: string; data?: Record<string, unknown> },
): Promise<ApiResponse<T>> {
  return patch(`${BASE}/${type}/${encodeURIComponent(id)}`, patch_body);
}

// ---------------------------------------------------------------------------
// Typed convenience aliases
// ---------------------------------------------------------------------------

export const requirements = {
  list: (status?: string) => listArtifacts<Requirement>("requirement", status),
  read: (id: string) => readArtifact<Requirement>("requirement", id),
  create: (fields: Parameters<typeof createArtifact>[1]) =>
    createArtifact<Requirement>("requirement", fields),
  update: (id: string, p: Parameters<typeof updateArtifact>[2]) =>
    updateArtifact<Requirement>("requirement", id, p),
};

export const milestones = {
  list: (status?: string) => listArtifacts<Milestone>("milestone", status),
  read: (id: string) => readArtifact<Milestone>("milestone", id),
  create: (fields: Parameters<typeof createArtifact>[1]) =>
    createArtifact<Milestone>("milestone", fields),
  update: (id: string, p: Parameters<typeof updateArtifact>[2]) =>
    updateArtifact<Milestone>("milestone", id, p),
};

export const tasks = {
  list: (status?: string) => listArtifacts<Task>("task", status),
  read: (id: string) => readArtifact<Task>("task", id),
  create: (fields: Parameters<typeof createArtifact>[1]) =>
    createArtifact<Task>("task", fields),
  update: (id: string, p: Parameters<typeof updateArtifact>[2]) =>
    updateArtifact<Task>("task", id, p),
};

export const workflows = {
  list: (status?: string) => listArtifacts<Workflow>("workflow", status),
  read: (id: string) => readArtifact<Workflow>("workflow", id),
};

export const workflowRuns = {
  list: (status?: string) =>
    listArtifacts<WorkflowRun>("workflow-run", status),
  read: (id: string) => readArtifact<WorkflowRun>("workflow-run", id),
};

export const sessions = {
  list: (status?: string) => listArtifacts<Session>("session", status),
  read: (id: string) => readArtifact<Session>("session", id),
  create: (fields: Parameters<typeof createArtifact>[1]) =>
    createArtifact<Session>("session", fields),
  update: (id: string, p: Parameters<typeof updateArtifact>[2]) =>
    updateArtifact<Session>("session", id, p),
  context: (id: string) =>
    get<SessionContext>(`${BASE}/session/${encodeURIComponent(id)}/context`),
};

export const evaluations = {
  list: (status?: string) =>
    listArtifacts<Evaluation>("evaluation", status),
  read: (id: string) => readArtifact<Evaluation>("evaluation", id),
};

export const feedback = {
  list: (status?: string) => listArtifacts<Feedback>("feedback", status),
  read: (id: string) => readArtifact<Feedback>("feedback", id),
  create: (fields: Parameters<typeof createArtifact>[1]) =>
    createArtifact<Feedback>("feedback", fields),
  update: (id: string, p: Parameters<typeof updateArtifact>[2]) =>
    updateArtifact<Feedback>("feedback", id, p),
};

export const distillations = {
  list: (status?: string) =>
    listArtifacts<Distillation>("distillation", status),
  read: (id: string) => readArtifact<Distillation>("distillation", id),
};

// ---------------------------------------------------------------------------
// Registry / Leaderboard
// ---------------------------------------------------------------------------

export function getLeaderboard(): Promise<ApiResponse<Leaderboard>> {
  return get(`${BASE}/registry/leaderboard`);
}

export function getRankings(
  taskType: string,
): Promise<ApiResponse<Leaderboard["rankings"][string]>> {
  return get(`${BASE}/registry/rank/${encodeURIComponent(taskType)}`);
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

export function checkGate(
  milestoneId: string,
): Promise<ApiResponse<GateResult>> {
  return get(
    `${BASE}/gate/${encodeURIComponent(milestoneId)}`,
  );
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export function getKnowledge(
  taskType: string,
  minConfidence?: number,
): Promise<ApiResponse<KnowledgeItem[]>> {
  const qs = minConfidence != null ? `?min_confidence=${minConfidence}` : "";
  return get(
    `${BASE}/knowledge/${encodeURIComponent(taskType)}${qs}`,
  );
}
