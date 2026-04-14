use axum::{routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum WorkerMessage {
    Register { worker_id: String, capabilities: Vec<String> },
    LeaseOffer { execution_id: String, work_item_id: String },
    LeaseAccept { execution_id: String },
    Heartbeat { worker_id: String, active_executions: u8 },
    Progress { execution_id: String, percent: u8, note: String },
    ArtifactReady { execution_id: String, uri: String, kind: String },
    Completed { execution_id: String, summary: String },
    Failed { execution_id: String, reason: String },
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_target(false)
        .compact()
        .init();

    let app = Router::new().route("/healthz", get(healthz));
    let addr = SocketAddr::from(([127, 0, 0, 1], 7500));
    info!(
        protocol = ?WorkerMessage::Register {
            worker_id: "wrk_demo".into(),
            capabilities: vec!["git".into(), "build".into()],
        },
        "runtime-broker scaffold booted"
    );
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind runtime-broker listener");
    axum::serve(listener, app)
        .await
        .expect("serve runtime-broker");
}

async fn healthz() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "runtime-broker",
        "status": "ok"
    }))
}
