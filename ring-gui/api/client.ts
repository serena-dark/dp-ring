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
  AssistantPlan,
  AssistantPlannerRequest,
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
  OrchestratedRequirementResult,
  OrchestratedFollowupResult,
  OpenAiAuthorizeUrlResponse,
  OpenAiDeviceAuthorization,
  OpenAiDevicePollResponse,
  OpenAiResponseRequest,
  OpenAiResponseResult,
  OpenAiStatus,
  OpenAiTokenExchangeResponse,
  OrchestratorAgentCard,
  OrchestratorConfig,
  OrchestratorJob,
  OrchestratorTickResult,
  ServiceStackStatus,
  UiConfig,
  UiConfigPatch,
  UiThemeTemplate,
  AdaptiveBundleEnvelope,
  DispatchBundleRecord,
  DispatchProtocolDescriptor,
} from "@ring-gui/types/api";

const BASE = "/api";

export interface CreateArtifactFields {
  name: string;
  status?: string;
  created_by?: string;
  session_id?: string | null;
  parent_id?: string;
  data?: Record<string, unknown>;
}

export interface UpdateArtifactFields {
  status?: string;
  session_id?: string | null;
  data?: Record<string, unknown>;
}

export interface OrchestratedRequirementFields {
  name: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  acceptance_criteria: Array<{
    id: string;
    description: string;
    satisfied: boolean;
  }>;
  created_by?: string;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

async function request<T>(
  path: string,
  init?: Pick<RequestInit, "method" | "body">,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: init?.method,
      body: init?.body,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const raw = await response.text();

    let parsed: unknown = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return {
          ok: false,
          error: "The API returned invalid JSON.",
          details: raw,
        };
      }
    }

    if (parsed && typeof parsed === "object" && "ok" in parsed) {
      return parsed as ApiResponse<T>;
    }

    return {
      ok: false,
      error: `Malformed API response (HTTP ${response.status}).`,
      details: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Network request failed.",
    };
  }
}

async function get<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path);
}

async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
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
  fields: CreateArtifactFields,
): Promise<ApiResponse<T>> {
  return post(`${BASE}/${type}`, fields);
}

/** Update an artifact (status transition, data patch, or both). */
export function updateArtifact<T = Envelope>(
  type: ArtifactType,
  id: string,
  patchBody: UpdateArtifactFields,
): Promise<ApiResponse<T>> {
  return patch(`${BASE}/${type}/${encodeURIComponent(id)}`, patchBody);
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
  finalize: (
    id: string,
    body: {
      commit_sha: string;
      judge_agent_id?: string;
      note?: string;
    },
  ) => post<Task>(`${BASE}/task/${encodeURIComponent(id)}/finalize`, body),
  judge: (
    id: string,
    body: {
      verdict: "approved" | "rejected";
      judge_agent_id?: string;
      note?: string;
    },
  ) => post<Task>(`${BASE}/task/${encodeURIComponent(id)}/judge`, body),
  replan: (
    id: string,
    body: {
      verdict: "redispatch" | "terminal";
      replanner_agent_id?: string;
      note?: string;
      task?: {
        name?: string;
        description?: string;
        target_type?: "project" | "module" | "file";
        target_path?: string;
        repo_root?: string;
        file_paths?: string[];
        build_command?: string | null;
        cleanup_paths?: string[];
        workflow_template_id?: string | null;
        execution_mode?: "serial" | "parallel" | null;
        acceptance_criteria?: Array<{
          id?: string;
          description: string;
        }>;
      };
    },
  ) => post<Task>(`${BASE}/task/${encodeURIComponent(id)}/replan`, body),
};

export const workflows = {
  list: (status?: string) => listArtifacts<Workflow>("workflow", status),
  read: (id: string) => readArtifact<Workflow>("workflow", id),
  update: (id: string, p: Parameters<typeof updateArtifact>[2]) =>
    updateArtifact<Workflow>("workflow", id, p),
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
  update: (id: string, p: Parameters<typeof updateArtifact>[2]) =>
    updateArtifact<Distillation>("distillation", id, p),
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

export const runtime = {
  services: {
    read: () => get<ServiceStackStatus>(`${BASE}/runtime/services`),
  },
};

export const openai = {
  status: () => get<OpenAiStatus>(`${BASE}/openai`),
  oauth: {
    start: (body?: { prompt?: string; scope?: string; audience?: string }) =>
      post<OpenAiAuthorizeUrlResponse>(`${BASE}/openai/oauth/start`, body ?? {}),
    complete: (body: { code: string; state: string }) =>
      post<OpenAiTokenExchangeResponse>(`${BASE}/openai/oauth/complete`, body),
  },
  authorizeUrl: (
    body: {
      state?: string;
      redirect_uri?: string;
      scope?: string;
      audience?: string;
      code_challenge?: string;
      code_challenge_method?: "S256";
      prompt?: string;
    },
  ) => post<OpenAiAuthorizeUrlResponse>(`${BASE}/openai/authorize-url`, body),
  exchangeToken: (
    body:
      | {
          grant_type?: "authorization_code";
          code: string;
          redirect_uri?: string;
          code_verifier?: string;
        }
      | {
          grant_type: "refresh_token";
          refresh_token: string;
        },
  ) => post<OpenAiTokenExchangeResponse>(`${BASE}/openai/token`, body),
  device: {
    start: (body?: { scope?: string; audience?: string }) =>
      post<OpenAiDeviceAuthorization>(`${BASE}/openai/device/start`, body ?? {}),
    poll: (body: { device_code: string; interval_seconds?: number }) =>
      post<OpenAiDevicePollResponse>(`${BASE}/openai/device/poll`, body),
  },
  refresh: () => post<OpenAiTokenExchangeResponse>(`${BASE}/openai/refresh`, {}),
  disconnect: () =>
    request<OpenAiTokenExchangeResponse>(`${BASE}/openai/session`, {
      method: "DELETE",
    }),
  responses: (body: OpenAiResponseRequest) =>
    post<OpenAiResponseResult>(`${BASE}/openai/responses`, body),
};

export const ui = {
  config: {
    read: () => get<UiConfig>(`${BASE}/ui/config`),
    update: (patchBody: UiConfigPatch) =>
      patch<UiConfig>(`${BASE}/ui/config`, patchBody),
  },
  themes: {
    list: () => get<UiThemeTemplate[]>(`${BASE}/ui/themes`),
  },
  assistant: {
    plan: (body: AssistantPlannerRequest) =>
      post<AssistantPlan>(`${BASE}/ui/assistant/plan`, body),
  },
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export const orchestrator = {
  agents: {
    list: () => get<OrchestratorAgentCard[]>(`${BASE}/orchestrator/agents`),
  },
  config: {
    read: () => get<OrchestratorConfig>(`${BASE}/orchestrator/config`),
    update: (patchBody: Partial<OrchestratorConfig>) =>
      patch<OrchestratorConfig>(`${BASE}/orchestrator/config`, patchBody),
  },
  jobs: {
    list: () => get<OrchestratorJob[]>(`${BASE}/orchestrator/jobs`),
    read: (id: string) =>
      get<OrchestratorJob>(`${BASE}/orchestrator/jobs/${encodeURIComponent(id)}`),
    reportAgent: (
      id: string,
      body: {
        agent_id?: string;
        status: "in_progress" | "completed" | "failed";
        note?: string;
      },
    ) =>
      post<OrchestratorJob>(
        `${BASE}/orchestrator/jobs/${encodeURIComponent(id)}/agent-report`,
        body,
      ),
    intervene: (
      id: string,
      body:
        | {
            action: "resolve";
            intervention_id: string;
            note?: string;
            actor?: string;
          }
        | {
            action: "create";
            stage: string;
            severity?: "warning" | "critical";
            reason: string;
            recommendation?: string;
            note?: string;
            actor?: string;
          },
    ) =>
      post<OrchestratorJob>(
        `${BASE}/orchestrator/jobs/${encodeURIComponent(id)}/interventions`,
        body,
      ),
    dispatchFollowup: (
      id: string,
      body?: {
        intervention_ids?: string[];
        note?: string;
      },
    ) =>
      post<OrchestratorJob>(
        `${BASE}/orchestrator/jobs/${encodeURIComponent(id)}/followup/dispatch`,
        body ?? {},
      ),
    createFollowupRequirement: (
      id: string,
      body?: {
        created_by?: string;
      },
    ) =>
      post<OrchestratedFollowupResult>(
        `${BASE}/orchestrator/jobs/${encodeURIComponent(id)}/followup/create-requirement`,
        body ?? {},
      ),
    retry: (id: string) =>
      post<OrchestratorJob>(
        `${BASE}/orchestrator/jobs/${encodeURIComponent(id)}/retry`,
        {},
      ),
    runAudit: (id: string) =>
      post<OrchestratorJob>(
        `${BASE}/orchestrator/jobs/${encodeURIComponent(id)}/audit`,
        {},
      ),
  },
  tick: () => post<OrchestratorTickResult>(`${BASE}/orchestrator/tick`, {}),
  createRequirement: (fields: OrchestratedRequirementFields) =>
    post<OrchestratedRequirementResult>(
      `${BASE}/orchestrator/requirements`,
      fields,
    ),
};

export const dispatch = {
  protocols: {
    list: () => get<DispatchProtocolDescriptor[]>(`${BASE}/dispatch/protocols`),
  },
  bundles: {
    list: () => get<DispatchBundleRecord[]>(`${BASE}/dispatch/bundles`),
    read: (id: string) =>
      get<DispatchBundleRecord>(`${BASE}/dispatch/bundles/${encodeURIComponent(id)}`),
    create: (body: AdaptiveBundleEnvelope) =>
      post<DispatchBundleRecord>(`${BASE}/dispatch/bundles`, body),
    report: (
      id: string,
      body: {
        status?: string;
        note?: string;
        source?: string;
      },
    ) =>
      post<DispatchBundleRecord>(
        `${BASE}/dispatch/bundles/${encodeURIComponent(id)}/report`,
        body,
      ),
  },
};
