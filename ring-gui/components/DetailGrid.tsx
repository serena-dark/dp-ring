import type { ReactNode } from "react";

export interface DetailGridItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

export function DetailGrid({
  items,
  className,
}: {
  items: DetailGridItem[];
  className?: string;
}) {
  return (
    <div className={className ? `detail-grid ${className}` : "detail-grid"}>
      {items.map((item) => (
        <div key={item.key} className="detail-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </div>
  );
}
