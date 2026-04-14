import { useEffect, useState } from "react";
import { dispatch, orchestrator } from "@ring-gui/api/client";
import { FactoryTable } from "@ring-gui/components/FactoryTable";
import { DataState } from "@ring-gui/components/DataState";
import { OrchestratorStateMachine } from "@ring-gui/components/OrchestratorStateMachine";
import { PageSection } from "@ring-gui/components/PageSection";
import { useNotifications } from "@ring-gui/lib/notifications";
import { isJobActive } from "@ring-gui/lib/orchestrator";
import {
  createDispatcherBundlesTableFactory,
  createDispatcherJobsTableFactory,
  createDispatcherProtocolsTableFactory,
} from "@ring-gui/lib/tables/dispatcher-factories";
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
  const protocolTableFactory = createDispatcherProtocolsTableFactory();
  const jobTableFactory = createDispatcherJobsTableFactory({
    selectedJobId: selectedJob?.id ?? null,
    onSelectJob: setSelectedJobId,
    jobAction,
    onMarkAgentComplete: (jobId) => {
      void markAgentComplete(jobId);
    },
    onRetryJob: (jobId) => {
      void retryJob(jobId);
    },
  });
  const bundleTableFactory = createDispatcherBundlesTableFactory();

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
        <PageSection id="summary" label="Dispatcher summary">
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
                <FactoryTable factory={protocolTableFactory} rows={dispatchProtocols} />
              ) : (
                <p className="empty-line">No protocols.</p>
              )}
            </article>
          </section>
        </PageSection>

        <PageSection id="records" label="Dispatcher records">
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
              <FactoryTable factory={jobTableFactory} rows={orchestratorJobs} />
            ) : (
              <p className="empty-line">No jobs.</p>
            )}
          </article>
        </PageSection>

        <PageSection id="related" label="Dispatcher bundles">
          <article className="panel">
            <div className="panel-header">
              <h3>Bundles</h3>
            </div>

            {dispatchBundles.length > 0 ? (
              <FactoryTable factory={bundleTableFactory} rows={dispatchBundles} />
            ) : (
              <p className="empty-line">No bundles.</p>
            )}
          </article>
        </PageSection>
      </DataState>
    </div>
  );
}
