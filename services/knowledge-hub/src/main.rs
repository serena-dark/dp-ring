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
        findings = snapshot.findings.len(),
        insights = snapshot.insights.len(),
        "knowledge-hub scaffold booted",
    );
}
