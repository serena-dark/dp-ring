import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBootstrap, listActivity, streamActivity } from "../lib/api";
import { initials } from "../lib/format";
import type { ActivityEvent } from "../lib/types";
import { TimelineRail } from "../components/TimelineRail";

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
  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    setLiveEvents(activityQuery.data ?? []);
  }, [activityQuery.data]);

  useEffect(() => {
    return streamActivity((event) => {
      setLiveEvents((current) => [event, ...current].slice(0, 16));
    });
  }, []);

  const viewer = bootstrapQuery.data?.viewer;
  const navigation = bootstrapQuery.data?.navigation ?? [];
  const statusCatalog = bootstrapQuery.data?.status_catalog ?? [];

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
