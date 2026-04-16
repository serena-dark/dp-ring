import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBootstrap, listActivity, streamActivity } from "../lib/api";
import { initials } from "../lib/format";
import type { ActivityEvent } from "../lib/types";
import { TimelineRail } from "../components/TimelineRail";

const EMPTY_EVENTS: ActivityEvent[] = [];
const EMPTY_COLLECTION: never[] = [];
const LIVE_EVENT_LIMIT = 16;

function mergeActivityEvents(baseEvents: ActivityEvent[], streamedEvents: ActivityEvent[]) {
  const merged = [...streamedEvents, ...baseEvents];
  const seen = new Set<string>();
  return merged.filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }
    seen.add(event.id);
    return true;
  }).slice(0, LIVE_EVENT_LIMIT);
}

export function AppShell() {
  const location = useLocation();
  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap"],
    queryFn: getBootstrap,
  });
  const activityQuery = useQuery({
    queryKey: ["activity"],
    queryFn: listActivity,
  });
  const [streamedEvents, setStreamedEvents] = useState<ActivityEvent[]>(EMPTY_EVENTS);

  useEffect(() => {
    return streamActivity((event) => {
      setStreamedEvents((current) => mergeActivityEvents(EMPTY_EVENTS, [event, ...current]));
    });
  }, []);

  const viewer = bootstrapQuery.data?.viewer;
  const navigation = bootstrapQuery.data?.navigation ?? EMPTY_COLLECTION;
  const statusCatalog = bootstrapQuery.data?.status_catalog ?? EMPTY_COLLECTION;
  const liveEvents = useMemo(
    () => mergeActivityEvents(activityQuery.data ?? EMPTY_EVENTS, streamedEvents),
    [activityQuery.data, streamedEvents],
  );

  const activeLabel = useMemo(() => {
    return navigation.find((item) => item.path === location.pathname)?.label ?? "Operator";
  }, [location.pathname, navigation]);

  return (
    <div className="app-shell">
      <aside className="nav-shell">
        <div className="brand-block">
          <p className="eyebrow">dp-ring v2</p>
          <h1>Operator Console</h1>
          <p className="brand-copy">
            Multi-tenant control plane for objectives, runs, reviews, findings, and insights.
          </p>
        </div>

        <nav className="nav-grid" aria-label="Operator navigation">
          {navigation.map((item) => (
            <Link
              key={item.id}
              to={item.path as never}
              className={`nav-card ${location.pathname === item.path ? "is-active" : ""}`}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </Link>
          ))}
        </nav>

        {viewer ? (
          <div className="viewer-card">
            <span className="viewer-avatar">{initials(viewer.display_name)}</span>
            <div>
              <strong>{viewer.display_name}</strong>
              <p>{viewer.role}</p>
            </div>
          </div>
        ) : null}
      </aside>

      <div className="workspace-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Active Surface</p>
            <h2>{activeLabel}</h2>
          </div>
          <div className="status-catalog">
            {statusCatalog.slice(0, 3).map((catalog) => (
              <div key={catalog.entity} className="catalog-pill">
                <strong>{catalog.entity}</strong>
                <span>{catalog.statuses.length} states</span>
              </div>
            ))}
          </div>
        </header>

        <main className="workspace-grid">
          <section className="workspace-main">
            <Outlet />
          </section>
          <TimelineRail events={liveEvents} />
        </main>
      </div>
    </div>
  );
}
