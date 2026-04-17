import {
  type FormEvent,
  type KeyboardEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  distillations,
  feedback,
  milestones,
  orchestrator,
  requirements,
  sessions,
  tasks,
  ui,
  workflows,
} from "@ring-gui/api/client";
import { TextField } from "@ring-gui/components/TextField";
import { titleize } from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { useRouter } from "@ring-gui/lib/router";
import {
  artifactPath,
  getPageDescriptors,
  matchRoute,
} from "@ring-gui/lib/routes";
import type {
  AssistantCreateFeedbackPayload,
  AssistantCreateRequirementPayload,
  AssistantCreateSessionPayload,
  AssistantPlan,
  AssistantProposedAction,
  AssistantTransitionPayload,
  NavigationTarget,
} from "@ring-gui/types/api";

function buildNavigationFromPlan(
  plan: AssistantPlan,
  currentPath: string,
): NavigationTarget {
  const query: Record<string, string | null> = {};

  for (const [key, value] of Object.entries(plan.navigation?.query ?? {})) {
    query[key] = value ?? null;
  }

  for (const adjustment of plan.page_adjustments) {
    if (adjustment.scope === "query") {
      query[adjustment.key] = adjustment.value;
    }
  }

  return {
    path: plan.navigation?.path ?? currentPath,
    query,
    section_id: plan.navigation?.section_id ?? null,
    source: "assistant",
  };
}

async function executeTransitionAction(payload: AssistantTransitionPayload) {
  switch (payload.artifact_type) {
    case "requirement":
      return requirements.update(payload.artifact_id, {
        status: payload.next_status,
      });
    case "milestone":
      return milestones.update(payload.artifact_id, {
        status: payload.next_status,
      });
    case "task":
      return tasks.update(payload.artifact_id, {
        status: payload.next_status,
      });
    case "workflow":
      return workflows.update(payload.artifact_id, {
        status: payload.next_status,
      });
    case "session":
      return sessions.update(payload.artifact_id, {
        status: payload.next_status,
      });
    case "feedback":
      return feedback.update(payload.artifact_id, {
        status: payload.next_status,
      });
    case "distillation":
      return distillations.update(payload.artifact_id, {
        status: payload.next_status,
      });
    default:
      return {
        ok: false as const,
        error: `Unsupported transition target: ${payload.artifact_type}`,
      };
  }
}

export function AssistantPane() {
  const [draft, setDraft] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const { notify } = useNotifications();
  const { pathname, search, hash, navigate } = useRouter();
  const route = matchRoute(pathname);
  const pageDescriptors = useMemo(() => getPageDescriptors(), []);

  async function applyNavigation(plan: AssistantPlan) {
    const target = buildNavigationFromPlan(plan, pathname);
    navigate(
      {
        path: target.path,
        query: target.query,
        hash: target.section_id,
        state: {
          source: target.source,
        },
      },
      { scroll: true },
    );
  }

  async function executeConfirmedAction(action: AssistantProposedAction) {
    let nextTarget:
      | {
          path: string;
          hash?: string | null;
          query?: Record<string, string | null | undefined>;
        }
      | null = null;

    if (action.kind === "create-requirement") {
      const payload = action.payload as AssistantCreateRequirementPayload | null;
      if (!payload) {
        notify("Requirement payload is incomplete.", "error");
        return;
      }

      const result = await orchestrator.createRequirement({
        name: payload.name,
        description: payload.description,
        priority: payload.priority,
        acceptance_criteria: payload.acceptance_criteria,
      });

      if (!result.ok) {
        notify(result.error, "error");
        return;
      }

      const requirementId = result.data.requirement.id;
      const systemMessage = `Created requirement ${requirementId}.`;
      nextTarget = {
        path: `/requirements/${requirementId}`,
        hash: "summary",
      };
      notify(systemMessage, "success");
    } else if (action.kind === "create-session") {
      const payload = action.payload as AssistantCreateSessionPayload | null;
      if (!payload || payload.task_ids.length === 0) {
        notify("Session payload is incomplete.", "error");
        return;
      }

      const result = await sessions.create({
        name: payload.name,
        status: "gate_pending",
        data: {
          requirement_id: payload.requirement_id,
          milestone_id: payload.milestone_id,
          task_ids: payload.task_ids,
          workflow_run_ids: [],
          execution_log: [],
        },
      });

      if (!result.ok) {
        notify(result.error, "error");
        return;
      }

      const systemMessage = `Created session ${result.data.id}.`;
      nextTarget = {
        path: `/sessions/${result.data.id}`,
        hash: "summary",
      };
      notify(systemMessage, "success");
    } else if (action.kind === "create-feedback") {
      const payload = action.payload as AssistantCreateFeedbackPayload | null;
      if (!payload) {
        notify("Feedback payload is incomplete.", "error");
        return;
      }

      const result = await feedback.create({
        name: `${payload.severity}-${payload.category}-${payload.target.id}`,
        status: "open",
        data: {
          source_session_id: payload.source_session_id,
          severity: payload.severity,
          category: payload.category,
          target: payload.target,
          description: payload.description,
          proposed_action: payload.proposed_action,
          resolution_session_id: null,
        },
      });

      if (!result.ok) {
        notify(result.error, "error");
        return;
      }

      const systemMessage = `Created feedback ${result.data.id}.`;
      nextTarget = {
        path: "/feedback",
        hash: "records",
        query: {
          status: "open",
        },
      };
      notify(systemMessage, "success");
    } else if (action.kind === "transition-artifact") {
      const payload = action.payload;
      if (!payload || !("artifact_type" in payload)) {
        notify("Transition payload is incomplete.", "error");
        return;
      }

      const result = await executeTransitionAction(payload);
      if (!result.ok) {
        notify(result.error, "error");
        return;
      }

      const systemMessage = `${titleize(payload.artifact_type)} ${payload.artifact_id} moved to ${titleize(payload.next_status)}.`;
      const detailPath = artifactPath(payload.artifact_type, payload.artifact_id);
      nextTarget = detailPath
        ? {
            path: detailPath,
            hash: "summary",
          }
        : {
            path: `/${payload.artifact_type}`,
          };
      notify(systemMessage, "success");
    }

    if (nextTarget) {
      navigate(
        {
          path: nextTarget.path,
          query: nextTarget.query,
          hash: nextTarget.hash,
          state: { source: "assistant" },
        },
        { scroll: true },
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = draft.trim();
    if (!prompt || isPlanning) {
      return;
    }

    setDraft("");
    setIsPlanning(true);

    const result = await ui.assistant.plan({
      prompt,
      current_route: {
        path: pathname,
        title: route?.title ?? null,
        search,
        hash,
      },
      pages: pageDescriptors,
    });

    if (!result.ok) {
      setIsPlanning(false);
      notify(result.error, "error");
      return;
    }

    const plan = result.data;

    if (plan.mode === "mutate") {
      const action = plan.proposed_action;
      if (!action) {
        setIsPlanning(false);
        notify("Assistant did not return an action.", "error");
        return;
      }

      if (!action.ready) {
        setIsPlanning(false);
        notify(
          action.missing_inputs.length > 0
            ? `Missing: ${action.missing_inputs.join(", ")}`
            : "Action is not ready yet.",
          "error",
        );
        return;
      }

      const confirmationMessage = [action.title, action.description]
        .filter(Boolean)
        .join("\n\n") || "Run assistant action?";
      const approved =
        typeof window === "undefined"
          ? true
          : window.confirm(confirmationMessage);

      if (!approved) {
        setIsPlanning(false);
        return;
      }

      await executeConfirmedAction(action);
      setIsPlanning(false);
      return;
    }

    if (plan.navigation) {
      await applyNavigation(plan);
    }

    if (plan.answer.trim()) {
      notify(plan.answer, "info");
    }

    setIsPlanning(false);
  }

  function handleInputKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      !draft.trim() ||
      isPlanning
    ) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  return (
    <aside className="assistant-pane" aria-label="Global assistant">
      <form ref={formRef} className="assistant-form" onSubmit={handleSubmit}>
        <TextField
          multiline
          rows={3}
          autoResize
          value={draft}
          onValueChange={setDraft}
          onKeyDown={handleInputKeyDown}
          ariaLabel="Global assistant prompt"
          disabled={isPlanning}
          controlClassName="assistant-input"
        />
      </form>
    </aside>
  );
}
