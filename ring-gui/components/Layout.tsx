import { type ReactNode } from "react";
import { AssistantPane } from "@ring-gui/components/AssistantPane";
import { AppLink, useRouter } from "@ring-gui/lib/router";
import { NAV_ITEMS } from "@ring-gui/lib/routes";

export function Layout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { href } = useRouter();
  const primaryNavItems = NAV_ITEMS.filter((item) => item.tier === "primary");
  const secondaryNavItems = NAV_ITEMS.filter((item) => item.tier === "secondary");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <h1>dp-ring</h1>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <AppLink
                key={item.path}
                to={item.path}
                className="nav-link"
              >
                {Icon ? (
                  <span className="nav-icon" aria-hidden="true">
                    <Icon size={18} stroke={1.8} />
                  </span>
                ) : null}
                <strong>{item.label}</strong>
              </AppLink>
            );
          })}
        </nav>

        <div className="nav-group">
          <p className="nav-group-label">Operational</p>
          <nav className="nav-list" aria-label="Secondary navigation">
            {secondaryNavItems.map((item) => (
              <AppLink
                key={item.path}
                to={item.path}
                className="nav-link nav-link-secondary"
              >
                <strong>{item.label}</strong>
              </AppLink>
            ))}
          </nav>
        </div>
      </aside>

      <div className="content-shell">
        <div className="workspace-pane">
          <header className="topbar">
            <div className="topbar-left">
              <h2>{title}</h2>
            </div>
            <code className="route-chip">{href}</code>
          </header>

          <main className="content">{children}</main>
        </div>

        <AssistantPane />
      </div>
    </div>
  );
}
