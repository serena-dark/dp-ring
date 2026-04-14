export interface Viewer {
  id: string;
  display_name: string;
  role: string;
  organization_id: string;
  workspace_id: string;
}

export interface NavSurface {
  id: string;
  label: string;
  path: string;
  description: string;
}

export interface StatusCatalog {
  entity: string;
  statuses: string[];
}

export interface Boards {
  objective_board: Record<string, number>;
  queue_board: Record<string, number>;
  run_timeline: Record<string, number>;
  review_inbox: Record<string, number>;
  worker_health: Record<string, number>;
}

export interface BootstrapPayload {
  viewer: Viewer;
  navigation: NavSurface[];
  status_catalog: StatusCatalog[];
  boards: Boards;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  environment: string;
}

export interface Repository {
  id: string;
  workspace_id: string;
  name: string;
  default_branch: string;
  clone_url: string;
  bound_worker_ids: string[];
}

export interface Objective {
  id: string;
  workspace_id: string;
  title: string;
  summary: string;
  status: string;
  priority: string;
  repository_id: string;
  blueprint_id: string;
  active_work_item_ids: string[];
  updated_at: string;
}

export interface BlueprintStep {
  id: string;
  title: string;
  summary: string;
}

export interface Blueprint {
  id: string;
  objective_id: string;
  status: string;
  summary: string;
  steps: BlueprintStep[];
}

export interface ScopeContract {
  repository_id: string;
  target_path: string;
  file_allowlist: string[];
  build_command?: string | null;
  cleanup_paths: string[];
}

export interface WorkItem {
  id: string;
  objective_id: string;
  blueprint_id: string;
  title: string;
  status: string;
  owner_lane: string;
  acceptance_contract: string[];
  scope: ScopeContract;
}

export interface ArtifactManifest {
  kind: string;
  uri: string;
}

export interface Execution {
  id: string;
  work_item_id: string;
  worker_id: string;
  status: string;
  launched_at: string;
  completed_at?: string | null;
  progress_percent: number;
  artifact_manifest: ArtifactManifest[];
}

export interface Review {
  id: string;
  work_item_id: string;
  execution_id: string;
  status: string;
  verdict: string;
  reviewer: string;
  notes: string;
}

export interface Finding {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
  severity: string;
  source_execution_id: string;
}

export interface Insight {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
  category: string;
  excerpt: string;
}

export interface Worker {
  id: string;
  workspace_id: string;
  display_name: string;
  status: string;
  capacity: number;
  active_executions: number;
  repository_ids: string[];
  capabilities: string[];
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  kind: string;
  title: string;
  summary: string;
  resource_type: string;
  resource_id: string;
}

export interface PlatformSnapshot {
  bootstrap: BootstrapPayload;
  orgs: Organization[];
  workspaces: Workspace[];
  repositories: Repository[];
  objectives: Objective[];
  blueprints: Blueprint[];
  work_items: WorkItem[];
  executions: Execution[];
  reviews: Review[];
  findings: Finding[];
  insights: Insight[];
  workers: Worker[];
  activity: ActivityEvent[];
}

export type ResourceKind =
  | "orgs"
  | "workspaces"
  | "repositories"
  | "objectives"
  | "blueprints"
  | "work-items"
  | "executions"
  | "reviews"
  | "findings"
  | "insights"
  | "workers";
