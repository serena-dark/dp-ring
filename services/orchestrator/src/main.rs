use platform_types::demo_snapshot;
use tracing::info;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_target(false)
        .compact()
        .init();

    let snapshot = demo_snapshot();
    info!(
        objectives = snapshot.objectives.len(),
        work_items = snapshot.work_items.len(),
        "orchestrator v2 scaffold booted",
    );
}
