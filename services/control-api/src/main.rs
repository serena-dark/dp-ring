use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::get,
    Json, Router,
};
use platform_types::{
    demo_snapshot, ActivityEvent, Blueprint, BootstrapPayload, Execution, Finding, Insight,
    Objective, Organization, PlatformSnapshot, Repository, Review, Role, Viewer, Worker,
    Workspace, WorkItem,
};
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio_stream::{wrappers::IntervalStream, StreamExt};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;

#[derive(Clone)]
struct AppState {
    snapshot: Arc<PlatformSnapshot>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_target(false)
        .compact()
        .init();

    let state = AppState {
        snapshot: Arc::new(demo_snapshot()),
    };

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/api/bootstrap", get(get_bootstrap))
        .route("/api/orgs", get(list_orgs))
        .route("/api/orgs/:id", get(read_org))
        .route("/api/workspaces", get(list_workspaces))
        .route("/api/workspaces/:id", get(read_workspace))
        .route("/api/repositories", get(list_repositories))
        .route("/api/repositories/:id", get(read_repository))
        .route("/api/objectives", get(list_objectives))
        .route("/api/objectives/:id", get(read_objective))
        .route("/api/blueprints", get(list_blueprints))
        .route("/api/blueprints/:id", get(read_blueprint))
        .route("/api/work-items", get(list_work_items))
        .route("/api/work-items/:id", get(read_work_item))
        .route("/api/executions", get(list_executions))
        .route("/api/executions/:id", get(read_execution))
        .route("/api/reviews", get(list_reviews))
        .route("/api/reviews/:id", get(read_review))
        .route("/api/findings", get(list_findings))
        .route("/api/findings/:id", get(read_finding))
        .route("/api/insights", get(list_insights))
        .route("/api/insights/:id", get(read_insight))
        .route("/api/workers", get(list_workers))
        .route("/api/workers/:id", get(read_worker))
        .route("/api/activity", get(list_activity))
        .route("/api/activity/stream", get(activity_stream))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([127, 0, 0, 1], 7400));
    info!("control-api listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind control-api listener");
    axum::serve(listener, app).await.expect("serve control-api");
}

async fn healthz() -> impl IntoResponse {
    Json(serde_json::json!({
        "service": "control-api",
        "status": "ok"
    }))
}

fn viewer_from_headers(headers: &HeaderMap, fallback: &Viewer) -> Viewer {
    let mut viewer = fallback.clone();
    if let Some(value) = headers.get("x-dp-user").and_then(|value| value.to_str().ok()) {
        viewer.display_name = value.to_string();
    }
    if let Some(value) = headers.get("x-dp-role").and_then(|value| value.to_str().ok()) {
        viewer.role = match value {
            "operator" => Role::Operator,
            "reviewer" => Role::Reviewer,
            "worker" => Role::Worker,
            _ => Role::Admin,
        };
    }
    viewer
}

async fn get_bootstrap(State(state): State<AppState>, headers: HeaderMap) -> Json<BootstrapPayload> {
    let mut payload = state.snapshot.bootstrap.clone();
    payload.viewer = viewer_from_headers(&headers, &payload.viewer);
    Json(payload)
}

async fn list_orgs(State(state): State<AppState>) -> Json<Vec<Organization>> {
    Json(state.snapshot.orgs.clone())
}

async fn read_org(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Organization> {
    read_one(&state.snapshot.orgs, &id)
}

async fn list_workspaces(State(state): State<AppState>) -> Json<Vec<Workspace>> {
    Json(state.snapshot.workspaces.clone())
}

async fn read_workspace(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Workspace> {
    read_one(&state.snapshot.workspaces, &id)
}

async fn list_repositories(State(state): State<AppState>) -> Json<Vec<Repository>> {
    Json(state.snapshot.repositories.clone())
}

async fn read_repository(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Repository> {
    read_one(&state.snapshot.repositories, &id)
}

async fn list_objectives(State(state): State<AppState>) -> Json<Vec<Objective>> {
    Json(state.snapshot.objectives.clone())
}

async fn read_objective(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Objective> {
    read_one(&state.snapshot.objectives, &id)
}

async fn list_blueprints(State(state): State<AppState>) -> Json<Vec<Blueprint>> {
    Json(state.snapshot.blueprints.clone())
}

async fn read_blueprint(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Blueprint> {
    read_one(&state.snapshot.blueprints, &id)
}

async fn list_work_items(State(state): State<AppState>) -> Json<Vec<WorkItem>> {
    Json(state.snapshot.work_items.clone())
}

async fn read_work_item(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<WorkItem> {
    read_one(&state.snapshot.work_items, &id)
}

async fn list_executions(State(state): State<AppState>) -> Json<Vec<Execution>> {
    Json(state.snapshot.executions.clone())
}

async fn read_execution(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Execution> {
    read_one(&state.snapshot.executions, &id)
}

async fn list_reviews(State(state): State<AppState>) -> Json<Vec<Review>> {
    Json(state.snapshot.reviews.clone())
}

async fn read_review(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Review> {
    read_one(&state.snapshot.reviews, &id)
}

async fn list_findings(State(state): State<AppState>) -> Json<Vec<Finding>> {
    Json(state.snapshot.findings.clone())
}

async fn read_finding(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Finding> {
    read_one(&state.snapshot.findings, &id)
}

async fn list_insights(State(state): State<AppState>) -> Json<Vec<Insight>> {
    Json(state.snapshot.insights.clone())
}

async fn read_insight(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Insight> {
    read_one(&state.snapshot.insights, &id)
}

async fn list_workers(State(state): State<AppState>) -> Json<Vec<Worker>> {
    Json(state.snapshot.workers.clone())
}

async fn read_worker(Path(id): Path<String>, State(state): State<AppState>) -> ResponseResult<Worker> {
    read_one(&state.snapshot.workers, &id)
}

async fn list_activity(State(state): State<AppState>) -> Json<Vec<ActivityEvent>> {
    Json(state.snapshot.activity.clone())
}

async fn activity_stream(
    State(state): State<AppState>,
) -> Sse<impl futures_util::Stream<Item = Result<Event, std::convert::Infallible>>> {
    let seed = state.snapshot.activity.clone();
    let stream = IntervalStream::new(tokio::time::interval(Duration::from_secs(3)))
        .enumerate()
        .map(move |(index, _)| {
            let event = &seed[index % seed.len()];
            let payload = serde_json::to_string(event).expect("serialize activity event");
            Ok(Event::default()
                .event(event.kind.clone())
                .id(event.id.clone())
                .data(payload))
        });

    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(10)))
}

type ResponseResult<T> = Result<Json<T>, (StatusCode, Json<serde_json::Value>)>;

fn read_one<T>(items: &[T], id: &str) -> ResponseResult<T>
where
    T: Clone + serde::Serialize + HasId,
{
    items.iter()
        .find(|item| item.id() == id)
        .cloned()
        .map(Json)
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "resource_not_found",
                    "resource_id": id
                })),
            )
        })
}

trait HasId {
    fn id(&self) -> &str;
}

macro_rules! impl_has_id {
    ($type_name:ty) => {
        impl HasId for $type_name {
            fn id(&self) -> &str {
                &self.id
            }
        }
    };
}

impl_has_id!(Organization);
impl_has_id!(Workspace);
impl_has_id!(Repository);
impl_has_id!(Objective);
impl_has_id!(Blueprint);
impl_has_id!(WorkItem);
impl_has_id!(Execution);
impl_has_id!(Review);
impl_has_id!(Finding);
impl_has_id!(Insight);
impl_has_id!(Worker);
