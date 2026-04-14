import type { ReactNode } from "react";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { formatDateTime } from "@ring-gui/lib/format";
import { AppLink } from "@ring-gui/lib/router";
import type { TableColumn } from "@ring-gui/lib/tables/core";

type CellValue<Row> = (row: Row, rowIndex: number) => ReactNode;
type CellClass<Row> = TableColumn<Row>["cellClassName"];

function renderCellStack({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode | null;
}) {
  return (
    <>
      <div>{primary}</div>
      {secondary ? <p className="subtle">{secondary}</p> : null}
    </>
  );
}

export function createRenderColumn<Row>(column: TableColumn<Row>): TableColumn<Row> {
  return column;
}

export function createTextColumn<Row>({
  key,
  header,
  value,
  cellClassName,
}: {
  key: string;
  header: ReactNode;
  value: CellValue<Row>;
  cellClassName?: CellClass<Row>;
}): TableColumn<Row> {
  return createRenderColumn({
    key,
    header,
    render: value,
    cellClassName,
  });
}

export function createStackColumn<Row>({
  key,
  header,
  primary,
  secondary,
  cellClassName,
}: {
  key: string;
  header: ReactNode;
  primary: CellValue<Row>;
  secondary?: CellValue<Row>;
  cellClassName?: CellClass<Row>;
}): TableColumn<Row> {
  return createRenderColumn({
    key,
    header,
    render: (row, rowIndex) =>
      renderCellStack({
        primary: primary(row, rowIndex),
        secondary: secondary?.(row, rowIndex) ?? null,
      }),
    cellClassName,
  });
}

export function createLinkColumn<Row>({
  key,
  header,
  to,
  label,
  linkClassName = "record-link",
  cellClassName,
}: {
  key: string;
  header: ReactNode;
  to: (row: Row, rowIndex: number) => string;
  label: CellValue<Row>;
  linkClassName?: string;
  cellClassName?: CellClass<Row>;
}): TableColumn<Row> {
  return createRenderColumn({
    key,
    header,
    render: (row, rowIndex) => (
      <AppLink
        to={to(row, rowIndex)}
        className={linkClassName}
      >
        {label(row, rowIndex)}
      </AppLink>
    ),
    cellClassName,
  });
}

export function createStatusBadgeColumn<Row>({
  key,
  header,
  value,
  kind = "status",
  cellClassName,
}: {
  key: string;
  header: ReactNode;
  value: (row: Row, rowIndex: number) => string | null | undefined;
  kind?: "status" | "severity" | "priority";
  cellClassName?: CellClass<Row>;
}): TableColumn<Row> {
  return createRenderColumn({
    key,
    header,
    render: (row, rowIndex) => (
      <StatusBadge value={value(row, rowIndex)} kind={kind} />
    ),
    cellClassName,
  });
}

export function createDateTimeColumn<Row>({
  key,
  header,
  value,
  cellClassName,
}: {
  key: string;
  header: ReactNode;
  value: (row: Row, rowIndex: number) => string | null | undefined;
  cellClassName?: CellClass<Row>;
}): TableColumn<Row> {
  return createRenderColumn({
    key,
    header,
    render: (row, rowIndex) => formatDateTime(value(row, rowIndex)),
    cellClassName,
  });
}
