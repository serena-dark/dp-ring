use serde::{Deserialize, Serialize};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkerConfig {
    worker_id: String,
    workspace_id: String,
    runtime_broker_url: String,
    repository_root: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_target(false)
        .compact()
        .init();

    let config = WorkerConfig {
        worker_id: std::env::var("DP_RING_WORKER_ID").unwrap_or_else(|_| "wrk_local".into()),
        workspace_id: std::env::var("DP_RING_WORKSPACE_ID").unwrap_or_else(|_| "ws_core".into()),
        runtime_broker_url: std::env::var("DP_RING_RUNTIME_BROKER_URL")
            .unwrap_or_else(|_| "ws://127.0.0.1:7500/ws".into()),
        repository_root: std::env::current_dir()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|_| ".".into()),
    };

    info!(
        worker_id = %config.worker_id,
        workspace_id = %config.workspace_id,
        runtime_broker_url = %config.runtime_broker_url,
        repository_root = %config.repository_root,
        "worker-daemon scaffold booted"
    );
}
