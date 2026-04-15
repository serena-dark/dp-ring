import type { ReactNode } from "react";

export function PageHero({
  title,
  badges = [],
  actions,
}: {
  title: ReactNode;
  badges?: Array<ReactNode | null | undefined>;
  actions?: ReactNode;
}) {
  const visibleBadges = badges.filter(Boolean);

  return (
    <section className="page-hero">
      <div>
        <h3>{title}</h3>
        {visibleBadges.length > 0 ? (
          <div className="badge-list">{visibleBadges}</div>
        ) : null}
      </div>
      {actions}
    </section>
  );
}
