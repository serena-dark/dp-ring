import { type KeyboardEvent, useState } from "react";
import { orchestrator } from "@ring-gui/api/client";
import { TextField } from "@ring-gui/components/TextField";
import { buildAcceptanceCriteria } from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { useRouter } from "@ring-gui/lib/router";
import { requirementPriorities } from "@ring-gui/lib/state";

function parseRequirementInput(input: string) {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const name = lines[0];
  const bodyLines = lines.slice(1);
  const criterionPattern = /^([-*+]|\d+\.)\s+|^\[(?: |x)\]\s+/i;

  const acceptanceLines = bodyLines
    .filter((line) => criterionPattern.test(line))
    .map((line) => line.replace(criterionPattern, "").trim())
    .filter(Boolean);

  const descriptionLines = bodyLines.filter(
    (line) => !criterionPattern.test(line),
  );
  const description =
    descriptionLines.join("\n") || bodyLines.join("\n") || name;

  const criteriaSource =
    acceptanceLines.length > 0
      ? acceptanceLines.join("\n")
      : descriptionLines.length > 0
        ? descriptionLines.join("\n")
        : name;

  return {
    name,
    description,
    acceptanceCriteria: buildAcceptanceCriteria(criteriaSource),
  };
}

export default function RequirementComposerCard() {
  const [draft, setDraft] = useState("");
  const [priority, setPriority] =
    useState<(typeof requirementPriorities)[number]>("high");
  const [submitting, setSubmitting] = useState(false);

  const { notify } = useNotifications();
  const { navigate } = useRouter();

  const submit = async () => {
    const parsed = parseRequirementInput(draft);
    if (!parsed) {
      notify("请输入 requirement 内容。", "error");
      return;
    }

    setSubmitting(true);
    const result = await orchestrator.createRequirement({
      name: parsed.name,
      description: parsed.description,
      priority,
      acceptance_criteria: parsed.acceptanceCriteria,
    });
    setSubmitting(false);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    setDraft("");
    setPriority("high");
    notify(
      `Created requirement ${result.data.requirement.id} and dispatched it to ${result.data.job.requirement_document.dispatch.agent_id}.`,
      "success",
    );
    navigate(`/requirements/${result.data.requirement.id}`);
  };

  const handleKeyDown = async (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (!submitting) {
      await submit();
    }
  };

  return (
    <section className="panel composer-card">
      <div className="panel-header">
        <h3>New requirement</h3>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="requirement-priority-card">Priority</label>
          <select
            id="requirement-priority-card"
            value={priority}
            onChange={(event) =>
              setPriority(
                event.target.value as (typeof requirementPriorities)[number],
              )
            }
          >
            {requirementPriorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <TextField
          id="requirement-card-input"
          label="Text"
          multiline
          rows={10}
          value={draft}
          onValueChange={setDraft}
          onKeyDown={(event) => {
            void handleKeyDown(event);
          }}
          placeholder={"第一行标题\n正文描述\n- 验收条件"}
          controlClassName="composer-textarea"
          containerStyle={{ gridColumn: "1 / -1" }}
        />
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button"
          disabled={submitting}
          onClick={() => {
            void submit();
          }}
        >
          {submitting ? "Creating..." : "Create"}
        </button>
      </div>
    </section>
  );
}
