import { StateActions } from "@ring-gui/components/StateActions";
import { formatPercent, titleize } from "@ring-gui/lib/format";
import { AppLink } from "@ring-gui/lib/router";
import { artifactPath } from "@ring-gui/lib/routes";
import {
  createDateTimeColumn,
  createLinkColumn,
  createRenderColumn,
  createStackColumn,
  createStatusBadgeColumn,
  createTextColumn,
} from "@ring-gui/lib/tables/column-factories";
import { createTableFactory } from "@ring-gui/lib/tables/core";
import type {
  Feedback,
  LeaderboardEntry,
  Requirement,
  Session,
  Task,
  Workflow,
} from "@ring-gui/types/api";

export function createRequirementListTableFactory({
  milestoneCountByRequirementId,
}: {
  milestoneCountByRequirementId: ReadonlyMap<string, number>;
}) {
  return createTableFactory<Requirement>({
    getRowKey: (item) => item.id,
    columns: [
      createLinkColumn({
        key: "id",
        header: "ID",
        to: (item) => `/requirements/${item.id}`,
        label: (item) => item.id,
      }),
      createTextColumn({
        key: "name",
        header: "Name",
        value: (item) => item.data.name,
      }),
      createStatusBadgeColumn({
        key: "status",
        header: "Status",
        value: (item) => item.status,
      }),
      createStatusBadgeColumn({
        key: "priority",
        header: "Priority",
        value: (item) => item.data.priority,
        kind: "priority",
      }),
      createTextColumn({
        key: "milestones",
        header: "Milestones",
        value: (item) => milestoneCountByRequirementId.get(item.id) ?? 0,
      }),
      createDateTimeColumn({
        key: "updated",
        header: "Updated",
        value: (item) => item.updated_at,
      }),
    ],
  });
}

export function createWorkflowListTableFactory() {
  return createTableFactory<Workflow>({
    getRowKey: (item) => item.id,
    columns: [
      createLinkColumn({
        key: "id",
        header: "ID",
        to: (item) => `/workflows/${item.id}`,
        label: (item) => item.id,
      }),
      createTextColumn({
        key: "name",
        header: "Name",
        value: (item) => item.data.name,
      }),
      createStatusBadgeColumn({
        key: "status",
        header: "Status",
        value: (item) => item.status,
      }),
      createTextColumn({
        key: "applicable-to",
        header: "Applicable to",
        value: (item) => item.data.applicable_to.join(", "),
      }),
      createTextColumn({
        key: "usage",
        header: "Usage",
        value: (item) => item.data.quality_history?.usage_count ?? 0,
      }),
      createTextColumn({
        key: "avg-score",
        header: "Avg score",
        value: (item) =>
          formatPercent(item.data.quality_history?.avg_composite_score ?? null),
      }),
      createDateTimeColumn({
        key: "updated",
        header: "Updated",
        value: (item) => item.updated_at,
      }),
    ],
  });
}

export function createTaskListTableFactory({
  workflowNameById,
  sessionNameById,
}: {
  workflowNameById: ReadonlyMap<string, string>;
  sessionNameById: ReadonlyMap<string, string>;
}) {
  return createTableFactory<Task>({
    getRowKey: (item) => item.id,
    columns: [
      createLinkColumn({
        key: "id",
        header: "ID",
        to: (item) => `/tasks/${item.id}`,
        label: (item) => item.id,
      }),
      createTextColumn({
        key: "name",
        header: "Name",
        value: (item) => item.data.name,
      }),
      createStatusBadgeColumn({
        key: "status",
        header: "Status",
        value: (item) => item.status,
      }),
      createTextColumn({
        key: "task-type",
        header: "Task type",
        value: (item) => item.data.task_type,
      }),
      createRenderColumn({
        key: "session",
        header: "Session",
        render: (item) =>
          item.session_id ? (
            <AppLink
              to={`/sessions/${item.session_id}`}
              className="record-link"
            >
              {sessionNameById.get(item.session_id) ?? item.session_id}
            </AppLink>
          ) : (
            "--"
          ),
      }),
      createTextColumn({
        key: "workflow",
        header: "Workflow",
        value: (item) =>
          item.data.workflow_template_id
            ? workflowNameById.get(item.data.workflow_template_id) ??
              item.data.workflow_template_id
            : "--",
      }),
      createDateTimeColumn({
        key: "updated",
        header: "Updated",
        value: (item) => item.updated_at,
      }),
    ],
  });
}

export function createSessionListTableFactory({
  requirementNameById,
  milestoneNameById,
}: {
  requirementNameById: ReadonlyMap<string, string>;
  milestoneNameById: ReadonlyMap<string, string>;
}) {
  return createTableFactory<Session>({
    getRowKey: (item) => item.id,
    columns: [
      createLinkColumn({
        key: "id",
        header: "ID",
        to: (item) => `/sessions/${item.id}`,
        label: (item) => item.id,
      }),
      createStatusBadgeColumn({
        key: "status",
        header: "Status",
        value: (item) => item.status,
      }),
      createTextColumn({
        key: "requirement",
        header: "Requirement",
        value: (item) =>
          requirementNameById.get(item.data.requirement_id) ??
          item.data.requirement_id,
      }),
      createTextColumn({
        key: "milestone",
        header: "Milestone",
        value: (item) =>
          milestoneNameById.get(item.data.milestone_id) ?? item.data.milestone_id,
      }),
      createTextColumn({
        key: "tasks",
        header: "Tasks",
        value: (item) => item.data.task_ids.length,
      }),
      createDateTimeColumn({
        key: "updated",
        header: "Updated",
        value: (item) => item.updated_at,
      }),
    ],
  });
}

export function createFeedbackListTableFactory({
  transitioningId,
  onTransition,
}: {
  transitioningId: string | null;
  onTransition: (feedbackId: string, nextStatus: string) => void;
}) {
  return createTableFactory<Feedback>({
    getRowKey: (item) => item.id,
    columns: [
      createTextColumn({
        key: "id",
        header: "ID",
        value: (item) => item.id,
      }),
      createStatusBadgeColumn({
        key: "severity",
        header: "Severity",
        value: (item) => item.data.severity,
        kind: "severity",
      }),
      createStatusBadgeColumn({
        key: "status",
        header: "Status",
        value: (item) => item.status,
      }),
      createTextColumn({
        key: "category",
        header: "Category",
        value: (item) => titleize(item.data.category),
      }),
      createStackColumn({
        key: "target",
        header: "Target",
        primary: (item) => {
          const path = artifactPath(item.data.target.type, item.data.target.id);
          const label = `${item.data.target.type}:${item.data.target.id}`;
          return path ? (
            <AppLink to={path} className="record-link">
              {label}
            </AppLink>
          ) : (
            label
          );
        },
        secondary: (item) => item.data.target.field,
      }),
      createStackColumn({
        key: "description",
        header: "Description",
        primary: (item) => <strong>{item.data.description}</strong>,
        secondary: (item) =>
          item.data.proposed_action
            ? `Proposed: ${item.data.proposed_action}`
            : null,
      }),
      createDateTimeColumn({
        key: "updated",
        header: "Updated",
        value: (item) => item.updated_at,
      }),
      createRenderColumn({
        key: "actions",
        header: "Actions",
        render: (item) => (
          <StateActions
            type="feedback"
            status={item.status}
            pendingStatus={transitioningId === item.id ? item.status : null}
            onTransition={(nextStatus) => onTransition(item.id, nextStatus)}
          />
        ),
      }),
    ],
  });
}

export function createLeaderboardTableFactory({
  workflowNameById,
}: {
  workflowNameById: ReadonlyMap<string, string>;
}) {
  return createTableFactory<LeaderboardEntry>({
    getRowKey: (item) => item.workflow_id,
    columns: [
      createTextColumn({
        key: "rank",
        header: "Rank",
        value: (_item, rowIndex) => `#${rowIndex + 1}`,
      }),
      createLinkColumn({
        key: "workflow",
        header: "Workflow",
        to: (item) => `/workflows/${item.workflow_id}`,
        label: (item) =>
          workflowNameById.get(item.workflow_id) ?? item.workflow_id,
      }),
      createTextColumn({
        key: "average-score",
        header: "Average score",
        value: (item) => formatPercent(item.avg_score),
      }),
      createTextColumn({
        key: "usage-count",
        header: "Usage count",
        value: (item) => item.usage_count,
      }),
      createDateTimeColumn({
        key: "last-used",
        header: "Last used",
        value: (item) => item.last_used,
      }),
    ],
  });
}
