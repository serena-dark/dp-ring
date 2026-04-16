import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DataTable } from "../components/DataTable";
import { renderDateTime, renderList, renderStatus, resourceLink } from "../components/table-renderers";
import { MetricCard } from "../components/MetricCard";
import { getBootstrap, listResource, readResource } from "../lib/api";
import { titleize } from "../lib/format";
import type {
  Blueprint,
  Execution,
  Finding,
  Insight,
  Objective,
  Repository,
  ResourceKind,
  Review,
  Worker,
  WorkItem,
} from "../lib/types";

function SurfaceFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="surface-stack">
      <section className="hero-panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-copy">{description}</p>
      </section>
      {children}
    </div>
  );
}

function BoardSummary({ boardKey }: { boardKey: keyof Awaited<ReturnType<typeof getBootstrap>>["boards"] }) {
  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap"],
    queryFn: getBootstrap,
  });
  const board = bootstrapQuery.data?.boards?.[boardKey] ?? {};

  return (
    <section className="metric-grid">
      {Object.entries(board).map(([key, value]) => (
        <MetricCard key={key} label={titleize(key)} value={value} />
      ))}
    </section>
  );
}

export function InboxPage() {
  const objectivesQuery = useQuery({
    queryKey: ["objectives"],
    queryFn: () => listResource<Objective>("objectives"),
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    queryFn: () => listResource<Review>("reviews"),
  });
  const findingsQuery = useQuery({
    queryKey: ["findings"],
    queryFn: () => listResource<Finding>("findings"),
  });

  const urgentObjectives = (objectivesQuery.data ?? []).slice(0, 4);
  const pendingReviews = (reviewsQuery.data ?? []).slice(0, 4);
  const openFindings = (findingsQuery.data ?? []).slice(0, 4);

  return (
    <SurfaceFrame
      eyebrow="Operational intake"
      title="Inbox"
      description="One surface for new objectives, pending reviews, and active interventions."
    >
      <BoardSummary boardKey="objective_board" />
      <div className="split-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Objective triage</p>
              <h2>Priority objectives</h2>
            </div>
          </div>
          <DataTable
            rows={urgentObjectives}
            columns={[
              { key: "title", header: "Objective", render: (item) => resourceLink("objectives", item.id, item.title) },
              { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
              { key: "priority", header: "Priority", render: (item) => item.priority },
              { key: "updated", header: "Updated", render: (item) => renderDateTime(item.updated_at) },
            ]}
          />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Review demand</p>
              <h2>Pending reviews</h2>
            </div>
          </div>
          <DataTable
            rows={pendingReviews}
            columns={[
              { key: "id", header: "Review", render: (item) => resourceLink("reviews", item.id, item.id) },
              { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
              { key: "verdict", header: "Verdict", render: (item) => item.verdict },
              { key: "reviewer", header: "Reviewer", render: (item) => item.reviewer },
            ]}
          />
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Interventions</p>
            <h2>Open findings</h2>
          </div>
        </div>
        <DataTable
          rows={openFindings}
          columns={[
            { key: "title", header: "Finding", render: (item) => resourceLink("findings", item.id, item.title) },
            { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
            { key: "severity", header: "Severity", render: (item) => item.severity },
            { key: "execution", header: "Execution", render: (item) => resourceLink("executions", item.source_execution_id) },
          ]}
        />
      </section>
    </SurfaceFrame>
  );
}

export function ObjectivesPage() {
  const objectivesQuery = useQuery({
    queryKey: ["objectives"],
    queryFn: () => listResource<Objective>("objectives"),
  });
  const blueprintsQuery = useQuery({
    queryKey: ["blueprints"],
    queryFn: () => listResource<Blueprint>("blueprints"),
  });

  return (
    <SurfaceFrame
      eyebrow="Objective command"
      title="Objectives"
      description="Track top-level delivery goals and the execution blueprints derived from them."
    >
      <BoardSummary boardKey="objective_board" />
      <div className="split-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Goal layer</p>
              <h2>Objectives</h2>
            </div>
          </div>
          <DataTable
            rows={objectivesQuery.data ?? []}
            columns={[
              { key: "title", header: "Title", render: (item) => resourceLink("objectives", item.id, item.title) },
              { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
              { key: "priority", header: "Priority", render: (item) => item.priority },
              { key: "work", header: "Active work", render: (item) => item.active_work_item_ids.length },
            ]}
          />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Plan layer</p>
              <h2>Blueprints</h2>
            </div>
          </div>
          <DataTable
            rows={blueprintsQuery.data ?? []}
            columns={[
              { key: "id", header: "Blueprint", render: (item) => resourceLink("blueprints", item.id, item.id) },
              { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
              { key: "steps", header: "Steps", render: (item) => item.steps.length },
              { key: "summary", header: "Summary", render: (item) => item.summary },
            ]}
          />
        </section>
      </div>
    </SurfaceFrame>
  );
}

export function QueuePage() {
  const workItemsQuery = useQuery({
    queryKey: ["work-items"],
    queryFn: () => listResource<WorkItem>("work-items"),
  });

  return (
    <SurfaceFrame
      eyebrow="Queue control"
      title="Queue"
      description="Observe lease pressure, file contracts, and work-item ownership lanes."
    >
      <BoardSummary boardKey="queue_board" />
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Execution units</p>
            <h2>Queued and leased work</h2>
          </div>
        </div>
        <DataTable
          rows={workItemsQuery.data ?? []}
          columns={[
            { key: "title", header: "Work item", render: (item) => resourceLink("work-items", item.id, item.title) },
            { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
            { key: "lane", header: "Lane", render: (item) => item.owner_lane },
            { key: "target", header: "Target", render: (item) => item.scope.target_path },
            { key: "files", header: "Allowlist", render: (item) => item.scope.file_allowlist.length },
          ]}
        />
      </section>
    </SurfaceFrame>
  );
}

export function RunsPage() {
  const executionsQuery = useQuery({
    queryKey: ["executions"],
    queryFn: () => listResource<Execution>("executions"),
  });

  return (
    <SurfaceFrame
      eyebrow="Runtime visibility"
      title="Runs"
      description="Inspect active executions, completion artifacts, and launch progress."
    >
      <BoardSummary boardKey="run_timeline" />
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Execution attempts</p>
            <h2>Runs</h2>
          </div>
        </div>
        <DataTable
          rows={executionsQuery.data ?? []}
          columns={[
            { key: "id", header: "Execution", render: (item) => resourceLink("executions", item.id, item.id) },
            { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
            { key: "worker", header: "Worker", render: (item) => resourceLink("workers", item.worker_id) },
            { key: "progress", header: "Progress", render: (item) => `${item.progress_percent}%` },
            { key: "launched", header: "Launched", render: (item) => renderDateTime(item.launched_at) },
          ]}
        />
      </section>
    </SurfaceFrame>
  );
}

export function ReviewsPage() {
  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    queryFn: () => listResource<Review>("reviews"),
  });

  return (
    <SurfaceFrame
      eyebrow="Judgement rail"
      title="Reviews"
      description="Track automated review output and the human decisions still blocking promotion."
    >
      <BoardSummary boardKey="review_inbox" />
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Review outcomes</p>
            <h2>Inbox</h2>
          </div>
        </div>
        <DataTable
          rows={reviewsQuery.data ?? []}
          columns={[
            { key: "id", header: "Review", render: (item) => resourceLink("reviews", item.id, item.id) },
            { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
            { key: "verdict", header: "Verdict", render: (item) => item.verdict },
            { key: "execution", header: "Execution", render: (item) => resourceLink("executions", item.execution_id) },
            { key: "reviewer", header: "Reviewer", render: (item) => item.reviewer },
          ]}
        />
      </section>
    </SurfaceFrame>
  );
}

export function FindingsPage() {
  const findingsQuery = useQuery({
    queryKey: ["findings"],
    queryFn: () => listResource<Finding>("findings"),
  });

  return (
    <SurfaceFrame
      eyebrow="Incident surface"
      title="Findings"
      description="See failures, operational defects, and unresolved execution risks."
    >
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Incidents and risk</p>
            <h2>Findings</h2>
          </div>
        </div>
        <DataTable
          rows={findingsQuery.data ?? []}
          columns={[
            { key: "title", header: "Finding", render: (item) => resourceLink("findings", item.id, item.title) },
            { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
            { key: "severity", header: "Severity", render: (item) => item.severity },
            { key: "source", header: "Source", render: (item) => resourceLink("executions", item.source_execution_id) },
          ]}
        />
      </section>
    </SurfaceFrame>
  );
}

export function InsightsPage() {
  const insightsQuery = useQuery({
    queryKey: ["insights"],
    queryFn: () => listResource<Insight>("insights"),
  });

  return (
    <SurfaceFrame
      eyebrow="Knowledge layer"
      title="Insights"
      description="Review the learning backlog that feeds future blueprint and queue decisions."
    >
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Published knowledge</p>
            <h2>Insights</h2>
          </div>
        </div>
        <DataTable
          rows={insightsQuery.data ?? []}
          columns={[
            { key: "title", header: "Insight", render: (item) => resourceLink("insights", item.id, item.title) },
            { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
            { key: "category", header: "Category", render: (item) => item.category },
            { key: "excerpt", header: "Excerpt", render: (item) => item.excerpt },
          ]}
        />
      </section>
    </SurfaceFrame>
  );
}

export function WorkersPage() {
  const workersQuery = useQuery({
    queryKey: ["workers"],
    queryFn: () => listResource<Worker>("workers"),
  });
  const repositoriesQuery = useQuery({
    queryKey: ["repositories"],
    queryFn: () => listResource<Repository>("repositories"),
  });

  return (
    <SurfaceFrame
      eyebrow="Local execution fleet"
      title="Workers"
      description="Track local worker daemons, capacity, repository bindings, and capabilities."
    >
      <BoardSummary boardKey="worker_health" />
      <div className="split-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Worker fleet</p>
              <h2>Daemons</h2>
            </div>
          </div>
          <DataTable
            rows={workersQuery.data ?? []}
            columns={[
              { key: "worker", header: "Worker", render: (item) => resourceLink("workers", item.id, item.display_name) },
              { key: "status", header: "Status", render: (item) => renderStatus(item.status) },
              { key: "capacity", header: "Capacity", render: (item) => item.capacity },
              { key: "active", header: "Active", render: (item) => item.active_executions },
              { key: "caps", header: "Capabilities", render: (item) => renderList(item.capabilities) },
            ]}
          />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Repository bindings</p>
              <h2>Repositories</h2>
            </div>
          </div>
          <DataTable
            rows={repositoriesQuery.data ?? []}
            columns={[
              { key: "repo", header: "Repository", render: (item) => resourceLink("repositories", item.id, item.name) },
              { key: "branch", header: "Default branch", render: (item) => item.default_branch },
              { key: "workers", header: "Bound workers", render: (item) => item.bound_worker_ids.length },
              { key: "clone", header: "Clone URL", render: (item) => item.clone_url },
            ]}
          />
        </section>
      </div>
    </SurfaceFrame>
  );
}

export function ResourceDetailPage() {
  const params = useParams({ from: "/resources/$kind/$id" });
  const kind = params.kind as ResourceKind;
  const resourceQuery = useQuery({
    queryKey: ["resource", kind, params.id],
    queryFn: () => readResource<Record<string, unknown> & { id: string }>(kind, params.id),
  });

  const data = resourceQuery.data;
  return (
    <SurfaceFrame
      eyebrow="Resource detail"
      title={`${titleize(params.kind)} / ${params.id}`}
      description="Generic resource inspector driven by REST collections instead of hardcoded artifact pages."
    >
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Structured payload</p>
            <h2>Inspector</h2>
          </div>
        </div>
        {data ? (
          <pre className="json-block">{JSON.stringify(data, null, 2)}</pre>
        ) : (
          <div className="empty-card">Resource not found.</div>
        )}
      </section>
    </SurfaceFrame>
  );
}
