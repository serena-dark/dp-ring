import { FormEvent, useState } from "react";
import {
  milestones,
  requirements,
  sessions,
  tasks,
  workflows,
} from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { FactoryTable } from "@ring-gui/components/FactoryTable";
import { PageSection } from "@ring-gui/components/PageSection";
import { TextField } from "@ring-gui/components/TextField";
import {
  buildAcceptanceCriteria,
  sortByUpdatedAt,
  titleize,
} from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { usePageQuery } from "@ring-gui/lib/page-state";
import { useRouter } from "@ring-gui/lib/router";
import { createTaskListTableFactory } from "@ring-gui/lib/tables/list-factories";
import { executionModes, taskStatuses } from "@ring-gui/lib/state";
import { useApi } from "@ring-gui/hooks/useApi";

export default function TaskList() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [executionMode, setExecutionMode] =
    useState<(typeof executionModes)[number]>("serial");
  const [targetType, setTargetType] = useState<"project" | "module" | "file">("module");
  const [targetPath, setTargetPath] = useState("");
  const [repoRoot, setRepoRoot] = useState(".");
  const [fileScopeText, setFileScopeText] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [cleanupPathsText, setCleanupPathsText] = useState("");
  const [criteriaText, setCriteriaText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { notify } = useNotifications();
  const { navigate } = useRouter();
  const { values, setQuery } = usePageQuery();
  const statusFilter = values.status ?? "";
  const composeOpen = values.compose === "1";

  const tasksState = useApi(
    () => tasks.list(statusFilter || undefined),
    [statusFilter],
  );
  const requirementsState = useApi(() => requirements.list(), []);
  const milestonesState = useApi(() => milestones.list(), []);
  const workflowsState = useApi(() => workflows.list(), []);
  const sessionsState = useApi(() => sessions.list(), []);

  const loading =
    tasksState.loading ||
    requirementsState.loading ||
    milestonesState.loading ||
    workflowsState.loading ||
    sessionsState.loading;
  const error =
    tasksState.error ??
    requirementsState.error ??
    milestonesState.error ??
    workflowsState.error ??
    sessionsState.error;

  const requirementItems = requirementsState.data ?? [];
  const milestoneItems = milestonesState.data ?? [];
  const workflowItems = workflowsState.data ?? [];
  const sessionItems = sessionsState.data ?? [];
  const visibleMilestones = milestoneItems.filter((item) =>
    requirementId ? item.data.requirement_id === requirementId : true,
  );

  const workflowNameById = new Map(
    workflowItems.map((item) => [item.id, item.data.name]),
  );
  const sessionNameById = new Map(sessionItems.map((item) => [item.id, item.id]));

  const parseTextList = (value: string) =>
    value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const acceptanceCriteria = buildAcceptanceCriteria(criteriaText);
    const filePaths = parseTextList(fileScopeText);
    const cleanupPaths = parseTextList(cleanupPathsText);
    if (
      !name.trim() ||
      !description.trim() ||
      !taskType.trim() ||
      !requirementId ||
      !milestoneId ||
      !targetPath.trim() ||
      !repoRoot.trim() ||
      filePaths.length === 0 ||
      acceptanceCriteria.length === 0
    ) {
      notify(
        "Name, description, task type, requirement, milestone, file scope, and criteria are required.",
        "error",
      );
      return;
    }

    setSubmitting(true);
    const result = await tasks.create({
      name: name.trim(),
      status: "pending",
      data: {
        name: name.trim(),
        description: description.trim(),
        task_type: taskType.trim(),
        requirement_id: requirementId,
        milestone_id: milestoneId,
        workflow_template_id: workflowId || null,
        workflow_run_id: null,
        execution_mode: executionMode,
        scope: {
          target_type: targetType,
          target_path: targetPath.trim(),
          repo_root: repoRoot.trim(),
          file_paths: filePaths,
        },
        execution: {
          judge_agent_id: null,
          review_status: "pending",
          completion_commit_sha: null,
          changed_files: [],
          scope_match: null,
          build_required: Boolean(buildCommand.trim()),
          build_command: buildCommand.trim() || null,
          build_status: buildCommand.trim() ? "pending" : "skipped",
          cleanup_paths: cleanupPaths,
          cleanup_status: cleanupPaths.length > 0 ? "pending" : "skipped",
          merge_status: "blocked",
          summary_path: null,
          review_packet: null,
          failure_feedback_id: null,
          failure_distillation_id: null,
          completion_distillation_id: null,
          last_error: null,
          checked_at: null,
          reviewed_at: null,
          note: null,
        },
        acceptance_criteria: acceptanceCriteria,
      },
    });
    setSubmitting(false);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Created task ${result.data.id}.`, "success");
    setName("");
    setDescription("");
    setTaskType("");
    setRequirementId("");
    setMilestoneId("");
    setWorkflowId("");
    setExecutionMode("serial");
    setTargetType("module");
    setTargetPath("");
    setRepoRoot(".");
    setFileScopeText("");
    setBuildCommand("");
    setCleanupPathsText("");
    setCriteriaText("");
    await tasksState.reload();
    navigate(`/tasks/${result.data.id}`);
  };

  const taskItems = sortByUpdatedAt(tasksState.data ?? []);
  const taskTableFactory = createTaskListTableFactory({
    workflowNameById,
    sessionNameById,
  });
  const activeTasks = taskItems.filter((item) =>
    ["ready", "in_progress"].includes(item.status),
  ).length;
  const linkedSessions = taskItems.filter((item) => item.session_id).length;

  return (
    <div className="page">
      <PageSection id="summary" label="Task summary">
        <div className="stats-grid">
          <article className="panel stat-card">
            <p className="eyebrow">Total tasks</p>
            <strong>{taskItems.length}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Active</p>
            <strong>{activeTasks}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Linked sessions</p>
            <strong>{linkedSessions}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Workflow templates</p>
            <strong>{workflowItems.length}</strong>
          </article>
        </div>
      </PageSection>

      <PageSection id="create" label="Create task">
      <details className="panel details-card" open={composeOpen || undefined}>
        <summary>
          <div className="panel-header">
            <h3>New task</h3>
          </div>
        </summary>
        <div className="details-body">
          <form onSubmit={handleSubmit} className="field-grid">
            <TextField
              id="task-name"
              label="Name"
              value={name}
              onValueChange={setName}
              placeholder="Implement ring frontend"
            />

            <TextField
              id="task-type"
              label="Task type"
              value={taskType}
              onValueChange={setTaskType}
              placeholder="feature-implementation"
            />

            <div className="field">
              <label htmlFor="task-requirement">Requirement</label>
              <select
                id="task-requirement"
                value={requirementId}
                onChange={(event) => {
                  setRequirementId(event.target.value);
                  setMilestoneId("");
                }}
              >
                <option value="">Select requirement</option>
                {requirementItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} - {item.data.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="task-milestone">Milestone</label>
              <select
                id="task-milestone"
                value={milestoneId}
                onChange={(event) => setMilestoneId(event.target.value)}
              >
                <option value="">Select milestone</option>
                {visibleMilestones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} - {item.data.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="task-workflow">Workflow template</label>
              <select
                id="task-workflow"
                value={workflowId}
                onChange={(event) => setWorkflowId(event.target.value)}
              >
                <option value="">Select workflow</option>
                {workflowItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} - {item.data.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="task-mode">Execution mode</label>
              <select
                id="task-mode"
                value={executionMode}
                onChange={(event) =>
                  setExecutionMode(
                    event.target.value as (typeof executionModes)[number],
                  )
                }
              >
                {executionModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {titleize(mode)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="task-target-type">Target type</label>
              <select
                id="task-target-type"
                value={targetType}
                onChange={(event) =>
                  setTargetType(event.target.value as "project" | "module" | "file")
                }
              >
                <option value="project">Project</option>
                <option value="module">Module</option>
                <option value="file">File</option>
              </select>
            </div>

            <TextField
              id="task-target-path"
              label="Target path"
              value={targetPath}
              onValueChange={setTargetPath}
              placeholder="ring-gui/components/Layout.tsx"
            />

            <TextField
              id="task-repo-root"
              label="Git repo root"
              value={repoRoot}
              onValueChange={setRepoRoot}
              placeholder="."
            />

            <TextField
              id="task-build-command"
              label="Build command"
              value={buildCommand}
              onValueChange={setBuildCommand}
              placeholder="npm run build"
            />

            <TextField
              id="task-description"
              label="Description"
              multiline
              value={description}
              onValueChange={setDescription}
              placeholder="Describe the scope of work and expected output."
              containerStyle={{ gridColumn: "1 / -1" }}
            />

            <TextField
              id="task-file-scope"
              label="File scope (comma or newline separated)"
              multiline
              value={fileScopeText}
              onValueChange={setFileScopeText}
              placeholder="ring-gui/components/Layout.tsx&#10;ring-gui/styles.css"
              containerStyle={{ gridColumn: "1 / -1" }}
            />

            <TextField
              id="task-cleanup-paths"
              label="Cleanup paths (optional, comma or newline separated)"
              multiline
              value={cleanupPathsText}
              onValueChange={setCleanupPathsText}
              placeholder="tmp/task-scratch"
              containerStyle={{ gridColumn: "1 / -1" }}
            />

            <TextField
              id="task-criteria"
              label="Acceptance criteria (one per line)"
              multiline
              value={criteriaText}
              onValueChange={setCriteriaText}
              placeholder="API client implemented&#10;Dashboard routes render&#10;Build and lint pass"
              containerStyle={{ gridColumn: "1 / -1" }}
            />

            <div className="button-row" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </details>
      </PageSection>

      <PageSection id="records" label="Task records">
      <section className="panel">
        <div className="panel-header">
          <h3>Tasks</h3>
          <div className="search-row">
            <select
              value={statusFilter}
              onChange={(event) =>
                setQuery({
                  status: event.target.value || null,
                })
              }
            >
              <option value="">All statuses</option>
              {taskStatuses.map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataState
          loading={loading}
          error={error}
          empty={taskItems.length === 0}
          emptyMessage="No tasks."
        >
          <FactoryTable factory={taskTableFactory} rows={taskItems} />
        </DataState>
      </section>
      </PageSection>
    </div>
  );
}
