import type { ReactNode } from "react";

export function PanelSection({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={className ? `panel ${className}` : "panel"}>
      <div className="panel-header">
        <h3>{title}</h3>
        {actions}
      </div>
      {children}
    </article>
  );
}
