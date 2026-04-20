import { demoSnapshot } from "./demo-data.ts";
import type {
  ActivityEvent,
  Blueprint,
  BootstrapPayload,
  Execution,
  Finding,
  Insight,
  Objective,
  Organization,
  PublicationRoot,
  Repository,
  ResourceKind,
  Review,
  ValidationReport,
  ValidationResult,
  Worker,
  Workspace,
  WorkItem,
} from "./types.ts";

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, fallback: () => T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch {
    return fallback();
  }
}

export function getBootstrap() {
  return request<BootstrapPayload>("/api/bootstrap", () => demoSnapshot.bootstrap);
}

export function listActivity() {
  return request<ActivityEvent[]>("/api/activity", () => demoSnapshot.activity);
}

export function streamActivity(onEvent: (event: ActivityEvent) => void) {
  const EventSourceCtor = typeof window === "undefined" ? null : window.EventSource;

  if (EventSourceCtor == null) {
    return () => {};
  }

  try {
    const source = new EventSourceCtor(`${API_BASE}/api/activity/stream`);
    source.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data) as ActivityEvent);
      } catch {
        // ignore malformed frames
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  } catch {
    return () => {};
  }
}

export const resourceMap = {
  orgs: () => request<Organization[]>("/api/orgs", () => demoSnapshot.orgs),
  workspaces: () =>
    request<Workspace[]>("/api/workspaces", () => demoSnapshot.workspaces),
  repositories: () =>
    request<Repository[]>("/api/repositories", () => demoSnapshot.repositories),
  objectives: () =>
    request<Objective[]>("/api/objectives", () => demoSnapshot.objectives),
  blueprints: () =>
    request<Blueprint[]>("/api/blueprints", () => demoSnapshot.blueprints),
  "work-items": () =>
    request<WorkItem[]>("/api/work-items", () => demoSnapshot.work_items),
  executions: () =>
    request<Execution[]>("/api/executions", () => demoSnapshot.executions),
  reviews: () => request<Review[]>("/api/reviews", () => demoSnapshot.reviews),
  "publication-roots": () =>
    request<PublicationRoot[]>("/api/publication-roots", () => demoSnapshot.publication_roots),
  "validation-reports": () =>
    request<ValidationReport[]>("/api/validation-reports", () => demoSnapshot.validation_reports),
  "validation-results": () =>
    request<ValidationResult[]>("/api/validation-results", () => demoSnapshot.validation_results),
  findings: () => request<Finding[]>("/api/findings", () => demoSnapshot.findings),
  insights: () => request<Insight[]>("/api/insights", () => demoSnapshot.insights),
  workers: () => request<Worker[]>("/api/workers", () => demoSnapshot.workers),
} satisfies Record<ResourceKind, () => Promise<unknown[]>>;

export async function listResource<T>(kind: ResourceKind): Promise<T[]> {
  return (await resourceMap[kind]()) as T[];
}

export async function readResource<T extends { id: string }>(
  kind: ResourceKind,
  id: string,
): Promise<T | null> {
  const collection = (await listResource<T>(kind)) ?? [];
  return collection.find((item) => item.id === id) ?? null;
}
