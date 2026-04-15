import type { ReactNode } from "react";

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row, rowIndex: number) => ReactNode;
  cellClassName?: string | ((row: Row, rowIndex: number) => string | undefined);
}

export interface TableFactory<Row> {
  columns: TableColumn<Row>[];
  getRowKey: (row: Row, rowIndex: number) => string;
  getRowClassName?: (row: Row, rowIndex: number) => string | undefined;
  onRowClick?: (row: Row, rowIndex: number) => void;
}

export function createTableFactory<Row>(factory: TableFactory<Row>): TableFactory<Row> {
  return factory;
}
