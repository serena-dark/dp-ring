import { Link } from "@tanstack/react-router";
import { formatDateTime } from "../lib/format";
import type { ActivityEvent, ResourceKind } from "../lib/types";

const resourceMap: Partial<Record<string, ResourceKind>> = {
  objective: "objectives",
  blueprint: "blueprints",
  work_item: "work-items",
  execution: "executions",
  review: "reviews",
  finding: "findings",
  insight: "insights",
  worker: "workers",
};

export function TimelineRail({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="timeline-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Activity Stream</p>
          <h2>Live domain activity</h2>
        </div>
      </div>
      <div className="timeline-list">
        {events.map((event) => {
          const kind = resourceMap[event.resource_type];
          return (
            <article className="timeline-item" key={event.id}>
              <div className="timeline-dot" />
              <div className="timeline-body">
                <div className="timeline-meta">
                  <span>{event.kind}</span>
                  <span>{formatDateTime(event.timestamp)}</span>
                </div>
                <strong>{event.title}</strong>
                <p>{event.summary}</p>
                {kind ? (
                  <Link
                    to="/resources/$kind/$id"
                    params={{ kind, id: event.resource_id }}
                    className="resource-link"
                  >
                    {event.resource_type}:{event.resource_id}
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
