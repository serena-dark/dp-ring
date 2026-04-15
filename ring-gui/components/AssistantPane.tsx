import {
  type FormEvent,
  useEffect,
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
import { useNotifications } from "@ring-gui/lib/notifications";
import { useRouter } from "@ring-gui/lib/router";
import {
  artifactPath,
  getPageDescriptors,
  matchRoute,
} from "@ring-gui/lib/routes";
import { titleize } from "@ring-gui/lib/format";
import type {
  AssistantCreateRequirementPayload,
  AssistantCreateSessionPayload,
  AssistantCreateFeedbackPayload,
  AssistantPlan,
  AssistantProposedAction,
  AssistantTransitionPayload,
  NavigationTarget,
} from "@ring-gui/types/api";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  plan?: AssistantPlan | null;
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { notify } = useNotifications();
  const { pathname, search, hash, navigate } = useRouter();
  const route = matchRoute(pathname);
  const pageDescriptors = useMemo(() => getPageDescriptors(), []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 208)}px`;
  }, [draft]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = draft.trim();
    if (!prompt || isPlanning) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: createMessageId(),
      role: "user",
      text: prompt,
    };

    setMessages((current) => [...current, userMessage]);
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

    setIsPlanning(false);

    if (!result.ok) {
      notify(result.error, "error");
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "system",
          text: result.error,
        },
      ]);
      return;
    }

    const assistantMessage: AssistantMessage = {
      id: createMessageId(),
      role: "assistant",
      text: result.data.answer,
      plan: result.data,
    };

    setMessages((current) => [...current, assistantMessage]);

    if (result.data.navigation) {
      await applyNavigation(result.data);
    }
  }

  async function confirmAction(messageId: string, action: AssistantProposedAction) {
    if (!action.ready || pendingActionId) {
      return;
    }

    setPendingActionId(messageId);
    let systemMessage = "Action completed.";
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
        setPendingActionId(null);
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
        setPendingActionId(null);
        return;
      }

      const requirementId = result.data.requirement.id;
      systemMessage = `Created requirement ${requirementId}.`;
      nextTarget = {
        path: `/requirements/${requirementId}`,
        hash: "summary",
      };
      notify(systemMessage, "success");
    } else if (action.kind === "create-session") {
      const payload = action.payload as AssistantCreateSessionPayload | null;
      if (!payload || payload.task_ids.length === 0) {
        notify("Session payload is incomplete.", "error");
        setPendingActionId(null);
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
        setPendingActionId(null);
        return;
      }

      systemMessage = `Created session ${result.data.id}.`;
      nextTarget = {
        path: `/sessions/${result.data.id}`,
        hash: "summary",
      };
      notify(systemMessage, "success");
    } else if (action.kind === "create-feedback") {
      const payload = action.payload as AssistantCreateFeedbackPayload | null;
      if (!payload) {
        notify("Feedback payload is incomplete.", "error");
        setPendingActionId(null);
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
        setPendingActionId(null);
        return;
      }

      systemMessage = `Created feedback ${result.data.id}.`;
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
        setPendingActionId(null);
        return;
      }

      const result = await executeTransitionAction(payload);
      if (!result.ok) {
        notify(result.error, "error");
        setPendingActionId(null);
        return;
      }

      systemMessage = `${titleize(payload.artifact_type)} ${payload.artifact_id} moved to ${titleize(payload.next_status)}.`;
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

    setPendingActionId(null);
    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: "system",
        text: systemMessage,
      },
    ]);

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

  return (
    <aside className="assistant-pane" aria-label="Global assistant">
      <div className="assistant-pane-header">
        <div>
          <p className="eyebrow">Assistant</p>
          <strong>Ask, jump, adjust</strong>
        </div>
        <span className="assistant-status">
          {isPlanning ? "Planning" : "Ready"}
        </span>
      </div>

      <div className="assistant-feed">
        {messages.length === 0 ? (
          <div className="assistant-message assistant-message-system">
            <p className="assistant-message-text">
              Ask about records, rankings, filters, or draft a safe action.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`assistant-message assistant-message-${message.role}`}
            >
              <div className="assistant-message-head">
                <strong>{titleize(message.role)}</strong>
                {message.plan ? (
                  <span className="assistant-confidence">
                    {Math.round(message.plan.confidence * 100)}%
                  </span>
                ) : null}
              </div>
              <p className="assistant-message-text">{message.text}</p>

              {message.plan?.mode === "mutate" ? (
                <div className="assistant-action-card">
                  <div className="assistant-action-head">
                    <strong>{message.plan.proposed_action.title}</strong>
                    <span className="assistant-action-mode">Confirm</span>
                  </div>
                  <p className="subtle">
                    {message.plan.proposed_action.description}
                  </p>
                  {message.plan.proposed_action.missing_inputs.length > 0 ? (
                    <p className="assistant-missing">
                      Missing: {message.plan.proposed_action.missing_inputs.join(", ")}
                    </p>
                  ) : null}
                  <div className="button-row">
                    {(() => {
                      const action = message.plan?.proposed_action;
                      return (
                    <button
                      type="button"
                      className="button button-small"
                      disabled={
                        !action?.ready ||
                        pendingActionId === message.id
                      }
                      onClick={() =>
                        action
                          ? void confirmAction(message.id, action)
                          : undefined
                      }
                    >
                      {pendingActionId === message.id ? "Running..." : "Confirm"}
                    </button>
                      );
                    })()}
                  </div>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      <form className="assistant-form" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={draft}
          rows={3}
          className="assistant-input"
          placeholder="Ask about counts, filters, pages, or draft an action"
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="assistant-form-footer">
          <p className="subtle assistant-context">
            {route?.title ?? "Unknown"} · {pathname}
          </p>
          <button type="submit" className="button" disabled={isPlanning || !draft.trim()}>
            {isPlanning ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}
