import { Link } from "@tanstack/react-router";
import { formatDateTime, titleize } from "../lib/format";
import type { ResourceKind } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

export function resourceLink(kind: ResourceKind, id: string, label?: string) {
  return (
    <Link
      to="/resources/$kind/$id"
      params={{ kind, id }}
      className="resource-link"
    >
      {label ?? id}
    </Link>
  );
}

export function renderStatus(value: string) {
  return <StatusBadge value={value} />;
}

export function renderDateTime(value?: string | null) {
  return <span>{formatDateTime(value)}</span>;
}

export function renderList(values: string[]) {
  return (
    <span className="cell-stack">
      {values.map((value) => (
        <span key={value}>{titleize(value)}</span>
      ))}
    </span>
  );
}
