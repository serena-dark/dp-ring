import { useEffect, useState } from "react";
import { dispatch, orchestrator } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { OrchestratorStateMachine } from "@ring-gui/components/OrchestratorStateMachine";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import {
  formatDateTime,
  titleize,
} from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import {
  getCurrentDocument,
  getCurrentStageLabel,
  isAwaitingAgent,
  isJobActive,
  isRetryable,
} from "@ring-gui/lib/orchestrator";
import { AppLink } from "@ring-gui/lib/router";
import { useApi } from "@ring-gui/hooks/useApi";

export default function Dispatcher() {
  const [idleDraftSeconds, setIdleDraftSeconds] = useState("");
  const [automationDraft, setAutomationDraft] = useState<boolean | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [pollingNow, setPollingNow] = useState(false);
  const [jobAction, setJobAction] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [resolvingInterventionId, setResolvingInterventionId] = useState<string | null>(null);
  const [followupAction, setFollowupAction] = useState<string | null>(null);

  const { notify } = useNotifications();

  const orchestratorAgentsState = useApi(() => orchestrator.agents.list(), []);
  const orchestratorConfigState = useApi(() => orchestrator.config.read(), []);
  const orchestratorJobsState = useApi(() => orchestrator.jobs.list(), []);
  const dispatchProtocolsState = useApi(() => dispatch.protocols.list(), []);
  const dispatchBundlesState = useApi(() => dispatch.bundles.list(), []);
  const reloadOrchestratorConfig = orchestratorConfigState.reload;
  const reloadOrchestratorJobs = orchestratorJobsState.reload;
  const reloadDispatchBundles = dispatchBundlesState.reload;

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void reloadOrchestratorConfig();
    }, 30_000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [reloadOrchestratorConfig]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      void reloadOrchestratorJobs();
      void reloadDispatchBundles();
    }, 5_000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [reloadDispatchBundles, reloadOrchestratorJobs]);

  const loading =
    orchestratorAgentsState.loading ||
    orchestratorConfigState.loading ||
    orchestratorJobsState.loading ||
    dispatchProtocolsState.loading ||
    dispatchBundlesState.loading;
  const error =
    orchestratorAgentsState.error ??
    orchestratorConfigState.error ??
    orchestratorJobsState.error ??
    dispatchProtocolsState.error ??
    dispatchBundlesState.error;

  const orchestratorAgents = orchestratorAgentsState.data ?? [];
  const orchestratorConfig = orchestratorConfigState.data;
  const orchestratorJobs = orchestratorJobsState.data ?? [];
  const dispatchProtocols = dispatchProtocolsState.data ?? [];
  const dispatchBundles = dispatchBundlesState.data ?? [];
  const activeJobs = orchestratorJobs.filter(isJobActive);
  const preferredSelectedJob = activeJobs[0] ?? orchestratorJobs[0] ?? null;
  const selectedJob =
    orchestratorJobs.find((job) => job.id === selectedJobId) ??
    preferredSelectedJob;
  const readyJobs = orchestratorJobs.filter(
    (job) => job.status === "session_dispatched",
  ).length;
  const reworkJobs = orchestratorJobs.filter((job) =>
    [
      "requirement_rework_required",
      "milestone_rework_required",
      "post_milestone_rework_required",
      "workflow_rework_required",
    ].includes(job.status),
  ).length;
  const idleThresholdSeconds = Math.round(
    (orchestratorConfig?.document_idle_threshold_ms ?? 120_000) / 1000,
  );
  const automationEnabled =
    automationDraft ?? orchestratorConfig?.automation?.enabled ?? false;
  const pollIntervalSeconds = Math.round(
    (orchestratorConfig?.poll_interval_ms ?? 30_000) / 1000,
  );
  const idleInputValue = idleDraftSeconds || String(idleThresholdSeconds);
  const readyBundles = dispatchBundles.filter(
    (bundle) => bundle.status === "ready_queued",
  ).length;
  const launchedBundles = dispatchBundles.filter(
    (bundle) => bundle.status === "session_launched",
  ).length;

  const saveConfig = async () => {
    const seconds = Number(idleInputValue);
    if (!Number.isFinite(seconds) || seconds < 30) {
      notify("Idle threshold must be at least 30 seconds.", "error");
      return;
    }

    setSavingConfig(true);
    const result = await orchestrator.config.update({
      document_idle_threshold_ms: seconds * 1000,
      automation: {
        ...(orchestratorConfig?.automation ?? {
          loopback_agents: true,
          loopback_worker: true,
          auto_judge: true,
          auto_replan: true,
          max_replan_depth: 1,
          worker_id: "worker-agent",
          judge_agent_id: "task-judge",
          replanner_agent_id: "task-replanner",
          commit_message_prefix: "ring auto",
          default_callback_protocol: "ring.workflow-run-report.v1",
        }),
        enabled: automationEnabled,
      },
    });
    setSavingConfig(false);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    setIdleDraftSeconds("");
    setAutomationDraft(null);
    notify("Dispatch config updated.", "success");
    await reloadOrchestratorConfig();
    await reloadOrchestratorJobs();
    await reloadDispatchBundles();
  };

  const runPollNow = async () => {
    setPollingNow(true);
    const result = await orchestrator.tick();
    setPollingNow(false);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify("Scheduler tick executed.", "success");
    await reloadOrchestratorJobs();
    await reloadDispatchBundles();
  };

  const markAgentComplete = async (jobId: string) => {
    setJobAction(`complete:${jobId}`);
    const result = await orchestrator.jobs.reportAgent(jobId, {
      status: "completed",
      note: "Completion reported from the dispatcher page.",
    });
    setJobAction(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Agent completion accepted for ${jobId}.`, "success");
    setSelectedJobId(jobId);
    await reloadOrchestratorJobs();
    await reloadDispatchBundles();
  };

  const retryJob = async (jobId: string) => {
    setJobAction(`retry:${jobId}`);
    const result = await orchestrator.jobs.retry(jobId);
    setJobAction(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Redispatched ${jobId}.`, "success");
    setSelectedJobId(jobId);
    await reloadOrchestratorJobs();
    await reloadDispatchBundles();
  };

  const resolveIntervention = async (jobId: string, interventionId: string) => {
    setResolvingInterventionId(interventionId);
    const result = await orchestrator.jobs.intervene(jobId, {
      action: "resolve",
      intervention_id: interventionId,
      note: "Resolved from the dispatcher page.",
      actor: "operator",
    });
    setResolvingInterventionId(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Intervention ${interventionId} resolved.`, "success");
    setSelectedJobId(jobId);
    await reloadOrchestratorJobs();
  };

  const draftFollowup = async (jobId: string) => {
    setFollowupAction("dispatch");
    const result = await orchestrator.jobs.dispatchFollowup(jobId, {
      note: "Draft follow-up requested from dispatcher page.",
    });
    setFollowupAction(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Follow-up brief drafted for ${jobId}.`, "success");
    setSelectedJobId(jobId);
    await reloadOrchestratorJobs();
  };

  const createFollowupRequirement = async (jobId: string) => {
    setFollowupAction("create");
    const result = await orchestrator.jobs.createFollowupRequirement(jobId, {
      created_by: "distiller",
    });
    setFollowupAction(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(
      `Follow-up requirement ${result.data.followup_requirement.id} created.`,
      "success",
    );
    setSelectedJobId(result.data.source_job.id);
    await reloadOrchestratorJobs();
  };

  return (
    <div className="page">
      <DataState loading={loading} error={error} empty={false}>
        <section className="panel-grid">
          <article className="panel">
            <div className="panel-header">
              <h3>Control</h3>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="idle-threshold-seconds">
                  Document idle threshold (seconds)
                </label>
                <input
                  id="idle-threshold-seconds"
                  value={idleInputValue}
                  onChange={(event) => setIdleDraftSeconds(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Poll interval</label>
                <input value={String(pollIntervalSeconds)} readOnly />
              </div>
              <div className="field">
                <label htmlFor="automation-enabled">Auto closed loop</label>
                <label
                  htmlFor="automation-enabled"
                  className="inline-checkbox"
                >
                  <input
                    id="automation-enabled"
                    type="checkbox"
                    checked={automationEnabled}
                    onChange={(event) =>
                      setAutomationDraft(event.target.checked)
                    }
                  />
                  <span>
                    Enabled
                  </span>
                </label>
              </div>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="button"
                disabled={savingConfig}
                onClick={() => {
                  void saveConfig();
                }}
              >
                {savingConfig ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="button button-ghost"
                disabled={pollingNow}
                onClick={() => {
                  void runPollNow();
                }}
              >
                {pollingNow ? "Polling..." : "Poll"}
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Overview</h3>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <dt>Active jobs</dt>
                <dd>{activeJobs.length}</dd>
              </div>
              <div className="detail-item">
                <dt>Sessions launched</dt>
                <dd>{readyJobs}</dd>
              </div>
              <div className="detail-item">
                <dt>Needs rework</dt>
                <dd>{reworkJobs}</dd>
              </div>
              <div className="detail-item">
                <dt>Writer agent</dt>
                <dd>{orchestratorConfig?.writer_agent_id ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Auditor</dt>
                <dd>{orchestratorConfig?.auditor_agent_id ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Milestone planner</dt>
                <dd>{orchestratorConfig?.milestone_planner_agent_id ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Prereq preparer</dt>
                <dd>{orchestratorConfig?.prerequisite_preparer_agent_id ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Task dispatcher</dt>
                <dd>{orchestratorConfig?.task_dispatcher_agent_id ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Workflow architect</dt>
                <dd>{orchestratorConfig?.workflow_designer_agent_id ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Task judge</dt>
                <dd>{orchestratorConfig?.task_judge_agent_id ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Distiller</dt>
                <dd>{orchestratorConfig?.distiller_agent_id ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Protocol</dt>
                <dd>{orchestratorConfig?.message_protocol_version ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Requirement docs</dt>
                <dd>{orchestratorConfig?.document_output_dir ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Milestone docs</dt>
                <dd>{orchestratorConfig?.milestone_output_dir ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Prereq docs</dt>
                <dd>{orchestratorConfig?.prerequisite_output_dir ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Task dispatch docs</dt>
                <dd>{orchestratorConfig?.task_dispatch_output_dir ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Workflow docs</dt>
                <dd>{orchestratorConfig?.workflow_output_dir ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Task summaries</dt>
                <dd>{orchestratorConfig?.task_summary_output_dir ?? "--"}</dd>
              </div>
              <div className="detail-item">
                <dt>Follow-up briefs</dt>
                <dd>{orchestratorConfig?.followup_output_dir ?? "--"}</dd>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Agents</h3>
            </div>
            {orchestratorAgents.length > 0 ? (
              <div className="panel-grid">
                {orchestratorAgents.map((agent) => (
                  <div key={agent.id} className="panel">
                    <strong>{agent.display_name}</strong>
                    <p className="subtle">{agent.id}</p>
                    <p className="subtle">
                      Accepts {agent.accepts.join(", ") || "--"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-line">No agents.</p>
            )}
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Protocols</h3>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <dt>Protocols</dt>
                <dd>{dispatchProtocols.length}</dd>
              </div>
              <div className="detail-item">
                <dt>Bundles queued</dt>
                <dd>{readyBundles}</dd>
              </div>
              <div className="detail-item">
                <dt>Bundles launched</dt>
                <dd>{launchedBundles}</dd>
              </div>
            </div>
            {dispatchProtocols.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Protocol</th>
                      <th>Support</th>
                      <th>Required fields</th>
                      <th>Transport</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchProtocols.map((protocol) => (
                      <tr key={protocol.id}>
                        <td>{protocol.id}</td>
                        <td>
                          <StatusBadge value={protocol.support_level} />
                        </td>
                        <td>{protocol.required_fields.join(", ")}</td>
                        <td>{protocol.transport_support.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-line">No protocols.</p>
            )}
          </article>
        </section>

        <OrchestratorStateMachine
          job={selectedJob}
          onResolveIntervention={(jobId, interventionId) => {
            void resolveIntervention(jobId, interventionId);
          }}
          resolvingInterventionId={resolvingInterventionId}
          onDispatchFollowup={(jobId) => {
            void draftFollowup(jobId);
          }}
          onCreateFollowupRequirement={(jobId) => {
            void createFollowupRequirement(jobId);
          }}
          followupAction={followupAction}
        />

        <article className="panel">
          <div className="panel-header">
            <h3>Jobs</h3>
          </div>

          {orchestratorJobs.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Requirement</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Document</th>
                    <th>Last activity</th>
                    <th>Completion signal</th>
                    <th>Output</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orchestratorJobs.map((job) => {
                    const currentDocument = getCurrentDocument(job);
                    const outputLabel =
                      job.status === "session_dispatched"
                        ? `${job.session_dispatch.session_id ?? "--"} / ${job.session_dispatch.workflow_run_ids.length} runs`
                        : job.status === "waiting_for_session_dispatch"
                          ? `${job.session_dispatch.waiting_task_ids.length} waiting / next tick launches batch`
                          : job.status === "workflow_rework_required"
                            ? job.workflow_preparation.parse_error ?? "Workflow plan needs rework"
                            : job.status.startsWith("workflow_")
                              ? `${job.workflow_preparation.waiting_tasks.length} ready tasks / ${job.workflow_preparation.generated_workflow_ids.length} custom workflows`
                              : job.status === "post_milestone_rework_required"
                                ? [
                                    job.post_milestone.prerequisite_analysis.parse_error,
                                    job.post_milestone.task_dispatch.parse_error,
                                  ]
                                    .filter(Boolean)
                                    .join(" / ") || "Readiness routing needs rework"
                                : job.status === "milestone_rework_required"
                                  ? job.milestone_plan.parse_error ?? "Plan needs rework"
                                  : job.status.startsWith("post_milestone_") ||
                                      job.status === "milestones_ready"
                                    ? `${job.post_milestone.prerequisite_analysis.distillation.feedback_ids.length} feedback / ${job.post_milestone.task_dispatch.generated_task_ids.length} tasks`
                                    : job.requirement_document.audit.verdict
                                      ? titleize(job.requirement_document.audit.verdict)
                                      : "--";
                    const interventionCount = job.interventions.filter(
                      (intervention) => intervention.status === "open",
                    ).length;

                    return (
                      <tr
                        key={job.id}
                        className={selectedJob?.id === job.id ? "is-selected" : undefined}
                        onClick={() => {
                          setSelectedJobId(job.id);
                        }}
                      >
                        <td>{job.id}</td>
                        <td>
                          <AppLink
                            to={`/requirements/${job.requirement_id}`}
                            className="record-link"
                          >
                            {job.requirement_name}
                          </AppLink>
                          <p className="subtle">{job.requirement_id}</p>
                        </td>
                        <td>{getCurrentStageLabel(job)}</td>
                        <td>
                          <StatusBadge value={job.status} />
                        </td>
                        <td>
                          <code>{currentDocument.path}</code>
                        </td>
                        <td>{formatDateTime(currentDocument.last_activity_at)}</td>
                        <td>
                          {currentDocument.completion_reason
                            ? titleize(currentDocument.completion_reason)
                            : "--"}
                        </td>
                        <td>{outputLabel}</td>
                        <td>
                          <div className="button-row">
                            {interventionCount > 0 ? (
                              <span className="subtle">
                                {interventionCount} intervention
                                {interventionCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                            {isAwaitingAgent(job) ? (
                              <button
                                type="button"
                                className="button button-ghost button-small"
                                disabled={jobAction === `complete:${job.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedJobId(job.id);
                                  void markAgentComplete(job.id);
                                }}
                              >
                                {jobAction === `complete:${job.id}`
                                  ? "Reporting..."
                                  : "Agent Complete"}
                              </button>
                            ) : null}
                            {isRetryable(job) ? (
                              <button
                                type="button"
                                className="button button-ghost button-small"
                                disabled={jobAction === `retry:${job.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedJobId(job.id);
                                  void retryJob(job.id);
                                }}
                              >
                                {jobAction === `retry:${job.id}`
                                  ? "Retrying..."
                                  : "Redispatch"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-line">No jobs.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Bundles</h3>
          </div>

          {dispatchBundles.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bundle</th>
                    <th>Protocol</th>
                    <th>Status</th>
                    <th>Goal</th>
                    <th>Tasks</th>
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchBundles.map((bundle) => (
                    <tr key={bundle.id}>
                      <td>{bundle.id}</td>
                      <td>{`${bundle.bundle_protocol}@${bundle.bundle_version}`}</td>
                      <td>
                        <StatusBadge value={bundle.status} />
                      </td>
                      <td>{bundle.canonical?.goal.title ?? "--"}</td>
                      <td>{bundle.planning.planned_task_ids.length}</td>
                      <td>{bundle.batching.session_id ?? "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-line">No bundles.</p>
          )}
        </article>
      </DataState>
    </div>
  );
}
