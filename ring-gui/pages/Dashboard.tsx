import { useEffect } from "react";
import {
  feedback,
  runtime,
  sessions,
  tasks,
  workflows,
} from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import {
  formatDateTime,
  sortByUpdatedAt,
} from "@ring-gui/lib/format";
import { AppLink } from "@ring-gui/lib/router";
import { useApi } from "@ring-gui/hooks/useApi";

function formatEndpoint(value: string): string {
  try {
    const url = new URL(value);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${path}`;
  } catch {
    return value;
  }
}

function formatUpdatedTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`;
}

export default function Dashboard() {
  const sessionsState = useApi(() => sessions.list(), []);
  const tasksState = useApi(() => tasks.list(), []);
  const feedbackState = useApi(() => feedback.list(), []);
  const workflowsState = useApi(() => workflows.list(), []);
  const serviceStackState = useApi(() => runtime.services.read(), []);
  const reloadServiceStack = serviceStackState.reload;

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void reloadServiceStack();
    }, 5_000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [reloadServiceStack]);

  const loading =
    sessionsState.loading ||
    tasksState.loading ||
    feedbackState.loading ||
    workflowsState.loading;
  const error =
    sessionsState.error ??
    tasksState.error ??
    feedbackState.error ??
    workflowsState.error;

  const sessionItems = sortByUpdatedAt(sessionsState.data ?? []);
  const taskItems = tasksState.data ?? [];
  const feedbackItems = feedbackState.data ?? [];
  const workflowItems = workflowsState.data ?? [];
  const serviceStack = serviceStackState.data;

  const activeSessions = sessionItems.filter(
    (item) => !["closed", "failed"].includes(item.status),
  ).length;
  const pendingTasks = taskItems.filter(
    (item) => !["completed", "cancelled"].includes(item.status),
  ).length;
  const openFeedback = feedbackItems.filter(
    (item) =>
      !["resolved", "wont_fix"].includes(item.status) &&
      ["critical", "major"].includes(item.data.severity),
  ).length;
  const recentSessions = sessionItems.slice(0, 5);
  const serviceChecks = [
    {
      label: "Dashboard",
      status: serviceStack?.frontend_healthy ? "healthy" : "offline",
      href: serviceStack?.frontend_url ?? "http://127.0.0.1:4174/",
      endpoint: formatEndpoint(
        serviceStack?.frontend_url ?? "http://127.0.0.1:4174/",
      ),
      extra: serviceStack?.frontend_process_alive
        ? `PID ${serviceStack.frontend_pid}`
        : null,
    },
    {
      label: "Proxy",
      status: serviceStack?.proxy_healthy ? "healthy" : "offline",
      href:
        serviceStack?.proxy_url ??
        "http://127.0.0.1:4174/api/orchestrator/workers",
      endpoint: formatEndpoint(
        serviceStack?.proxy_url ??
          "http://127.0.0.1:4174/api/orchestrator/workers",
      ),
      extra: null,
    },
    {
      label: "API Server",
      status: serviceStack?.backend_healthy ? "healthy" : "offline",
      href: serviceStack?.backend_url ?? "http://127.0.0.1:3100/",
      endpoint: formatEndpoint(
        serviceStack?.backend_url ?? "http://127.0.0.1:3100/",
      ),
      extra: serviceStack?.backend_process_alive
        ? `PID ${serviceStack.backend_pid}`
        : null,
    },
  ];

  return (
    <div className="page">
      <DataState
        loading={loading}
        error={error}
        empty={false}
      >
        <section className="stats-grid">
          <article className="panel stat-card">
            <p className="eyebrow">Sessions</p>
            <strong>{activeSessions}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Tasks</p>
            <strong>{pendingTasks}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Feedback</p>
            <strong>{openFeedback}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Workflows</p>
            <strong>{workflowItems.length}</strong>
          </article>
        </section>

        <section className="split-grid">
          <article className="panel">
            <div className="panel-header">
              <h3>Recent sessions</h3>
              <AppLink to="/sessions" className="button button-ghost button-small">
                All
              </AppLink>
            </div>

            {recentSessions.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Status</th>
                      <th>Requirement</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <AppLink
                            to={`/sessions/${session.id}`}
                            className="record-link"
                          >
                            {session.id}
                          </AppLink>
                        </td>
                        <td>
                          <StatusBadge value={session.status} />
                        </td>
                        <td>{session.data.requirement_id}</td>
                        <td>{formatDateTime(session.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-line">No sessions.</p>
            )}
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Ring health</h3>
              <button
                type="button"
                className="button button-ghost button-small icon-button service-refresh-button"
                aria-label="Refresh services"
                title="Refresh services"
                onClick={() => {
                  void reloadServiceStack();
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M13.2 7.2A5.3 5.3 0 1 0 8.8 13v-1.6A3.8 3.8 0 1 1 11.7 5H9.6v1.6H15V1.2h-1.8z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>

            <section className="service-status-card">
              <div className="service-status-header">
                <div>
                  <h3>Health</h3>
                </div>
                <StatusBadge
                  value={
                    serviceStack?.overall_status ??
                    (serviceStackState.loading ? "unmanaged" : "offline")
                  }
                />
              </div>

              {serviceStackState.error ? (
                <p className="empty-line">
                  {serviceStackState.error}
                </p>
              ) : (
                <>
                  <div className="service-status-grid">
                    {serviceChecks.map((service) => (
                      <div key={service.label} className="service-status-item">
                        <div className="service-status-title">
                          <strong>{service.label}</strong>
                          <StatusBadge value={service.status} />
                        </div>
                        <code className="service-endpoint">
                          {service.endpoint}
                        </code>
                        <div className="service-status-footer">
                          {service.extra ? (
                            <p className="subtle">{service.extra}</p>
                          ) : (
                            <span />
                          )}
                          <a
                            href={service.href}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-ghost button-small service-status-button"
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="subtle service-status-summary">
                    Updated {formatUpdatedTimestamp(serviceStack?.verified_at)}
                  </p>
                </>
              )}
            </section>
          </article>
        </section>
      </DataState>
    </div>
  );
}
