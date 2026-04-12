import type { ArtifactType } from "@ring-gui/types/api";
import { titleize } from "@ring-gui/lib/format";
import { validNextStatuses } from "@ring-gui/lib/state";

export function StateActions({
  type,
  status,
  pendingStatus,
  onTransition,
}: {
  type: ArtifactType;
  status: string;
  pendingStatus: string | null;
  onTransition: (nextStatus: string) => void;
}) {
  const nextStatuses = validNextStatuses(type, status);

  if (nextStatuses.length === 0) {
    return null;
  }

  return (
    <div className="button-row">
      {nextStatuses.map((nextStatus) => (
        <button
          key={nextStatus}
          type="button"
          className="button button-ghost"
          disabled={pendingStatus !== null}
          onClick={() => onTransition(nextStatus)}
        >
          {pendingStatus === nextStatus
            ? "Updating..."
            : `Move to ${titleize(nextStatus)}`}
        </button>
      ))}
    </div>
  );
}
