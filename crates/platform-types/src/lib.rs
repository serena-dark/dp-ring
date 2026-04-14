use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Admin,
    Operator,
    Reviewer,
    Worker,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewer {
    pub id: String,
    pub display_name: String,
    pub role: Role,
    pub organization_id: String,
    pub workspace_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organization {
    pub id: String,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub organization_id: String,
    pub name: String,
    pub slug: String,
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub default_branch: String,
    pub clone_url: String,
    pub bound_worker_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlueprintStep {
    pub id: String,
    pub title: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Objective {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub summary: String,
    pub status: String,
    pub priority: String,
    pub repository_id: String,
    pub blueprint_id: String,
    pub active_work_item_ids: Vec<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Blueprint {
    pub id: String,
    pub objective_id: String,
    pub status: String,
    pub summary: String,
    pub steps: Vec<BlueprintStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeContract {
    pub repository_id: String,
    pub target_path: String,
    pub file_allowlist: Vec<String>,
    pub build_command: Option<String>,
    pub cleanup_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkItem {
    pub id: String,
    pub objective_id: String,
    pub blueprint_id: String,
    pub title: String,
    pub status: String,
    pub owner_lane: String,
    pub acceptance_contract: Vec<String>,
    pub scope: ScopeContract,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactManifest {
    pub kind: String,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Execution {
    pub id: String,
    pub work_item_id: String,
    pub worker_id: String,
    pub status: String,
    pub launched_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub progress_percent: u8,
    pub artifact_manifest: Vec<ArtifactManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Review {
    pub id: String,
    pub work_item_id: String,
    pub execution_id: String,
    pub status: String,
    pub verdict: String,
    pub reviewer: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub status: String,
    pub severity: String,
    pub source_execution_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Insight {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub status: String,
    pub category: String,
    pub excerpt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Worker {
    pub id: String,
    pub workspace_id: String,
    pub display_name: String,
    pub status: String,
    pub capacity: u8,
    pub active_executions: u8,
    pub repository_ids: Vec<String>,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavSurface {
    pub id: String,
    pub label: String,
    pub path: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusCatalog {
    pub entity: String,
    pub statuses: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub kind: String,
    pub title: String,
    pub summary: String,
    pub resource_type: String,
    pub resource_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveBoard {
    pub submitted: u32,
    pub planned: u32,
    pub executing: u32,
    pub reviewing: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueBoard {
    pub queued: u32,
    pub leased: u32,
    pub running: u32,
    pub review_pending: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunTimeline {
    pub active: u32,
    pub timed_out: u32,
    pub failed: u32,
    pub completed_today: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewInbox {
    pub pending: u32,
    pub split_required: u32,
    pub rejected: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerHealth {
    pub online: u32,
    pub degraded: u32,
    pub offline: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Boards {
    pub objective_board: ObjectiveBoard,
    pub queue_board: QueueBoard,
    pub run_timeline: RunTimeline,
    pub review_inbox: ReviewInbox,
    pub worker_health: WorkerHealth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapPayload {
    pub viewer: Viewer,
    pub navigation: Vec<NavSurface>,
    pub status_catalog: Vec<StatusCatalog>,
    pub boards: Boards,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformSnapshot {
    pub bootstrap: BootstrapPayload,
    pub orgs: Vec<Organization>,
    pub workspaces: Vec<Workspace>,
    pub repositories: Vec<Repository>,
    pub objectives: Vec<Objective>,
    pub blueprints: Vec<Blueprint>,
    pub work_items: Vec<WorkItem>,
    pub executions: Vec<Execution>,
    pub reviews: Vec<Review>,
    pub findings: Vec<Finding>,
    pub insights: Vec<Insight>,
    pub workers: Vec<Worker>,
    pub activity: Vec<ActivityEvent>,
}

pub fn demo_snapshot() -> PlatformSnapshot {
    let now = Utc::now();
    PlatformSnapshot {
        bootstrap: BootstrapPayload {
            viewer: Viewer {
                id: "usr_admin".into(),
                display_name: "Ops Control".into(),
                role: Role::Admin,
                organization_id: "org_acme".into(),
                workspace_id: "ws_core".into(),
            },
            navigation: vec![
                nav("inbox", "Inbox", "/inbox", "Triage, review, and intervention queues"),
                nav("objectives", "Objectives", "/objectives", "Objective and blueprint overview"),
                nav("queue", "Queue", "/queue", "Work item leasing and backlog pressure"),
                nav("runs", "Runs", "/runs", "Execution timelines, logs, and artifacts"),
                nav("reviews", "Reviews", "/reviews", "Automated and human review outcomes"),
                nav("findings", "Findings", "/findings", "Incidents, risks, and defects"),
                nav("insights", "Insights", "/insights", "Codified learnings and patterns"),
                nav("workers", "Workers", "/workers", "Connected local worker daemons"),
            ],
            status_catalog: vec![
                status_catalog(
                    "objective",
                    &["submitted", "triaged", "planned", "executing", "reviewing", "done", "failed", "canceled"],
                ),
                status_catalog("blueprint", &["draft", "approved", "rejected", "superseded"]),
                status_catalog("work_item", &["queued", "leased", "running", "produced", "review_pending", "accepted", "rejected", "abandoned"]),
                status_catalog("execution", &["created", "assigned", "active", "succeeded", "failed", "timed_out", "canceled"]),
                status_catalog("review", &["pending", "accepted", "rejected", "split_required"]),
                status_catalog("finding", &["open", "acknowledged", "resolved", "dismissed"]),
                status_catalog("insight", &["draft", "published", "retired"]),
            ],
            boards: Boards {
                objective_board: ObjectiveBoard {
                    submitted: 2,
                    planned: 3,
                    executing: 5,
                    reviewing: 2,
                },
                queue_board: QueueBoard {
                    queued: 11,
                    leased: 4,
                    running: 6,
                    review_pending: 3,
                },
                run_timeline: RunTimeline {
                    active: 6,
                    timed_out: 1,
                    failed: 2,
                    completed_today: 14,
                },
                review_inbox: ReviewInbox {
                    pending: 4,
                    split_required: 1,
                    rejected: 2,
                },
                worker_health: WorkerHealth {
                    online: 3,
                    degraded: 1,
                    offline: 1,
                },
            },
        },
        orgs: vec![Organization {
            id: "org_acme".into(),
            name: "Acme Delivery".into(),
            slug: "acme-delivery".into(),
        }],
        workspaces: vec![Workspace {
            id: "ws_core".into(),
            organization_id: "org_acme".into(),
            name: "Core Platform".into(),
            slug: "core-platform".into(),
            environment: "production-mirror".into(),
        }],
        repositories: vec![Repository {
            id: "repo_dpring".into(),
            workspace_id: "ws_core".into(),
            name: "dp-ring".into(),
            default_branch: "main".into(),
            clone_url: "ssh://git.example.com/acme/dp-ring.git".into(),
            bound_worker_ids: vec!["wrk_shanghai".into(), "wrk_berlin".into()],
        }],
        objectives: vec![
            Objective {
                id: "obj_inbox_rebuild".into(),
                workspace_id: "ws_core".into(),
                title: "Rebuild operator inbox around event-driven review lanes".into(),
                summary: "Replace artifact-centric UI with board-driven operator lanes.".into(),
                status: "executing".into(),
                priority: "critical".into(),
                repository_id: "repo_dpring".into(),
                blueprint_id: "bp_inbox_rebuild".into(),
                active_work_item_ids: vec!["wi_nav_registry".into(), "wi_sse_stream".into()],
                updated_at: now,
            },
            Objective {
                id: "obj_rbac_cutover".into(),
                workspace_id: "ws_core".into(),
                title: "Ship org-level RBAC for control-plane mutation APIs".into(),
                summary: "Enforce admin/operator/reviewer/worker role gates in control-api.".into(),
                status: "reviewing".into(),
                priority: "high".into(),
                repository_id: "repo_dpring".into(),
                blueprint_id: "bp_rbac_cutover".into(),
                active_work_item_ids: vec!["wi_claim_mapper".into()],
                updated_at: now,
            },
        ],
        blueprints: vec![
            Blueprint {
                id: "bp_inbox_rebuild".into(),
                objective_id: "obj_inbox_rebuild".into(),
                status: "approved".into(),
                summary: "Create intake, queue, run, review, incident, and insight surfaces from read models.".into(),
                steps: vec![
                    step("bpstep_1", "Board read models", "Publish aggregate counters for all work lanes."),
                    step("bpstep_2", "Navigation metadata", "Serve operator surfaces from control-api bootstrap."),
                    step("bpstep_3", "SSE activity rail", "Stream domain activity into the console."),
                ],
            },
            Blueprint {
                id: "bp_rbac_cutover".into(),
                objective_id: "obj_rbac_cutover".into(),
                status: "draft".into(),
                summary: "Introduce organization/workspace-aware claim validation and role enforcement.".into(),
                steps: vec![
                    step("bpstep_4", "Keycloak discovery", "Read issuer, audience, and JWKS from config."),
                    step("bpstep_5", "Route policies", "Map role permissions to command endpoints."),
                ],
            },
        ],
        work_items: vec![
            WorkItem {
                id: "wi_nav_registry".into(),
                objective_id: "obj_inbox_rebuild".into(),
                blueprint_id: "bp_inbox_rebuild".into(),
                title: "Serve operator navigation from bootstrap payload".into(),
                status: "running".into(),
                owner_lane: "ui-metadata".into(),
                acceptance_contract: vec![
                    "Bootstrap payload includes eight operator surfaces.".into(),
                    "Console renders navigation from API metadata only.".into(),
                ],
                scope: ScopeContract {
                    repository_id: "repo_dpring".into(),
                    target_path: "apps/operator-web/src".into(),
                    file_allowlist: vec!["src/routes".into(), "src/layouts".into()],
                    build_command: Some("npm run build".into()),
                    cleanup_paths: vec!["apps/operator-web/dist".into()],
                },
            },
            WorkItem {
                id: "wi_sse_stream".into(),
                objective_id: "obj_inbox_rebuild".into(),
                blueprint_id: "bp_inbox_rebuild".into(),
                title: "Expose activity stream from control-api".into(),
                status: "review_pending".into(),
                owner_lane: "control-api".into(),
                acceptance_contract: vec![
                    "SSE stream emits domain events with resource links.".into(),
                    "Frontend timeline updates without polling.".into(),
                ],
                scope: ScopeContract {
                    repository_id: "repo_dpring".into(),
                    target_path: "services/control-api/src".into(),
                    file_allowlist: vec!["src/main.rs".into()],
                    build_command: None,
                    cleanup_paths: vec![],
                },
            },
            WorkItem {
                id: "wi_claim_mapper".into(),
                objective_id: "obj_rbac_cutover".into(),
                blueprint_id: "bp_rbac_cutover".into(),
                title: "Map OIDC claims into workspace-scoped viewer roles".into(),
                status: "produced".into(),
                owner_lane: "auth".into(),
                acceptance_contract: vec![
                    "Viewer claims include org and workspace identifiers.".into(),
                    "Mutation routes reject unsupported roles.".into(),
                ],
                scope: ScopeContract {
                    repository_id: "repo_dpring".into(),
                    target_path: "services/control-api/src/auth".into(),
                    file_allowlist: vec!["src/main.rs".into()],
                    build_command: None,
                    cleanup_paths: vec![],
                },
            },
        ],
        executions: vec![
            Execution {
                id: "exe_shanghai_001".into(),
                work_item_id: "wi_nav_registry".into(),
                worker_id: "wrk_shanghai".into(),
                status: "active".into(),
                launched_at: now,
                completed_at: None,
                progress_percent: 62,
                artifact_manifest: vec![ArtifactManifest {
                    kind: "console-log".into(),
                    uri: "s3://dp-ring/artifacts/exe_shanghai_001/log.txt".into(),
                }],
            },
            Execution {
                id: "exe_berlin_014".into(),
                work_item_id: "wi_sse_stream".into(),
                worker_id: "wrk_berlin".into(),
                status: "succeeded".into(),
                launched_at: now,
                completed_at: Some(now),
                progress_percent: 100,
                artifact_manifest: vec![ArtifactManifest {
                    kind: "patch".into(),
                    uri: "s3://dp-ring/artifacts/exe_berlin_014/patch.diff".into(),
                }],
            },
        ],
        reviews: vec![
            Review {
                id: "rev_001".into(),
                work_item_id: "wi_sse_stream".into(),
                execution_id: "exe_berlin_014".into(),
                status: "pending".into(),
                verdict: "awaiting-human".into(),
                reviewer: "review-bot".into(),
                notes: "SSE semantics look correct. Confirm client retry policy.".into(),
            },
            Review {
                id: "rev_002".into(),
                work_item_id: "wi_claim_mapper".into(),
                execution_id: "exe_berlin_014".into(),
                status: "split_required".into(),
                verdict: "split".into(),
                reviewer: "ops-review".into(),
                notes: "Separate discovery, verification, and policy mapping concerns.".into(),
            },
        ],
        findings: vec![Finding {
            id: "fdg_001".into(),
            workspace_id: "ws_core".into(),
            title: "Worker timeout threshold too aggressive for artifact uploads".into(),
            status: "open".into(),
            severity: "major".into(),
            source_execution_id: "exe_shanghai_001".into(),
        }],
        insights: vec![Insight {
            id: "ins_001".into(),
            workspace_id: "ws_core".into(),
            title: "Expose queue pressure as first-class board metric".into(),
            status: "published".into(),
            category: "control-plane".into(),
            excerpt: "Operators react faster when backlog, lease, and review counts share the same view.".into(),
        }],
        workers: vec![
            Worker {
                id: "wrk_shanghai".into(),
                workspace_id: "ws_core".into(),
                display_name: "Shanghai daemon".into(),
                status: "online".into(),
                capacity: 4,
                active_executions: 2,
                repository_ids: vec!["repo_dpring".into()],
                capabilities: vec!["git".into(), "build".into(), "artifact-upload".into()],
            },
            Worker {
                id: "wrk_berlin".into(),
                workspace_id: "ws_core".into(),
                display_name: "Berlin daemon".into(),
                status: "degraded".into(),
                capacity: 3,
                active_executions: 1,
                repository_ids: vec!["repo_dpring".into()],
                capabilities: vec!["git".into(), "build".into(), "review-packet".into()],
            },
        ],
        activity: vec![
            activity("evt_001", "objective.submitted.v1", "Objective submitted", "Rebuild operator inbox entered triage.", "objective", "obj_inbox_rebuild"),
            activity("evt_002", "workitem.queued.v1", "Work item queued", "Serve operator navigation from bootstrap payload.", "work_item", "wi_nav_registry"),
            activity("evt_003", "execution.assigned.v1", "Execution assigned", "Shanghai daemon accepted lease for inbox work item.", "execution", "exe_shanghai_001"),
            activity("evt_004", "review.completed.v1", "Review split required", "RBAC claim mapping must be decomposed.", "review", "rev_002"),
            activity("evt_005", "finding.opened.v1", "Finding opened", "Artifact upload timeout threshold raised for investigation.", "finding", "fdg_001"),
            activity("evt_006", "insight.published.v1", "Insight published", "Queue pressure now drives operator priority views.", "insight", "ins_001"),
        ],
    }
}

fn nav(id: &str, label: &str, path: &str, description: &str) -> NavSurface {
    NavSurface {
        id: id.into(),
        label: label.into(),
        path: path.into(),
        description: description.into(),
    }
}

fn status_catalog(entity: &str, statuses: &[&str]) -> StatusCatalog {
    StatusCatalog {
        entity: entity.into(),
        statuses: statuses.iter().map(|value| value.to_string()).collect(),
    }
}

fn step(id: &str, title: &str, summary: &str) -> BlueprintStep {
    BlueprintStep {
        id: id.into(),
        title: title.into(),
        summary: summary.into(),
    }
}

fn activity(
    id: &str,
    kind: &str,
    title: &str,
    summary: &str,
    resource_type: &str,
    resource_id: &str,
) -> ActivityEvent {
    ActivityEvent {
        id: id.into(),
        timestamp: Utc::now(),
        kind: kind.into(),
        title: title.into(),
        summary: summary.into(),
        resource_type: resource_type.into(),
        resource_id: resource_id.into(),
    }
}
