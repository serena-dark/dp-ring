import { useEffect, useState } from "react";
import { OrchestratorMachineDiagram } from "@ring-gui/components/OrchestratorMachineDiagram";
import { OrchestratorMachineSidebar } from "@ring-gui/components/OrchestratorMachineSidebar";
import { OrchestratorMachineSummary } from "@ring-gui/components/OrchestratorMachineSummary";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { getCurrentDispatch, getCurrentStageLabel } from "@ring-gui/lib/orchestrator";
import type { OrchestratorJob } from "@ring-gui/types/api";

export function OrchestratorStateMachine({
  job,
  onResolveIntervention,
  resolvingInterventionId = null,
  onDispatchFollowup,
  onCreateFollowupRequirement,
  followupAction = null,
}: {
  job: OrchestratorJob | null;
  onResolveIntervention?: (jobId: string, interventionId: string) => void;
  resolvingInterventionId?: string | null;
  onDispatchFollowup?: (jobId: string) => void;
  onCreateFollowupRequirement?: (jobId: string) => void;
  followupAction?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, []);

  if (!job) {
    return (
      <article className="panel state-panel">
        <h3>State machine</h3>
      </article>
    );
  }

  const currentDispatch = getCurrentDispatch(job);

  return (
    <article className="panel orchestrator-machine-panel">
      <div className="panel-header">
        <div>
          <h3>{job.requirement_name}</h3>
          <p className="subtle">
            {job.id} · {getCurrentStageLabel(job)} · agent{" "}
            {currentDispatch.agent_id}
          </p>
        </div>
        <StatusBadge value={job.status} />
      </div>

      <OrchestratorMachineSummary job={job} now={now} />

      <div className="machine-layout">
        <OrchestratorMachineDiagram job={job} />
        <OrchestratorMachineSidebar
          job={job}
          onResolveIntervention={onResolveIntervention}
          resolvingInterventionId={resolvingInterventionId}
          onDispatchFollowup={onDispatchFollowup}
          onCreateFollowupRequirement={onCreateFollowupRequirement}
          followupAction={followupAction}
        />
      </div>
    </article>
  );
}
