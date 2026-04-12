import { type ReactNode } from "react";
import { AppLink, useRouter } from "@ring-gui/lib/router";
import { NAV_ITEMS } from "@ring-gui/lib/routes";

export function Layout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { pathname } = useRouter();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <h1>dp-ring</h1>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <AppLink key={item.path} to={item.path} className="nav-link">
              <strong>{item.label}</strong>
            </AppLink>
          ))}
        </nav>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="topbar-left">
            <h2>{title}</h2>
          </div>
          <code className="route-chip">{pathname}</code>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
