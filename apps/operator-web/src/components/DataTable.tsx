import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { formatDateTime, titleize } from "../lib/format";
import type { ResourceKind } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  emptyLabel = "No records",
}: {
  rows: T[];
  columns: TableColumn<T>[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <div className="empty-card">{emptyLabel}</div>;
  }

  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
