import type { TableFactory } from "@ring-gui/lib/tables/core";

function resolveClassName<Row>(
  value:
    | string
    | ((row: Row, rowIndex: number) => string | undefined)
    | undefined,
  row: Row,
  rowIndex: number,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return typeof value === "function" ? value(row, rowIndex) : value;
}

export function FactoryTable<Row>({
  factory,
  rows,
}: {
  factory: TableFactory<Row>;
  rows: Row[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {factory.columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const rowClassName = [
              resolveClassName(factory.getRowClassName, row, rowIndex),
              factory.onRowClick ? "is-clickable" : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined;

            return (
              <tr
                key={factory.getRowKey(row, rowIndex)}
                className={rowClassName}
                onClick={
                  factory.onRowClick
                    ? () => {
                        factory.onRowClick?.(row, rowIndex);
                      }
                    : undefined
                }
              >
                {factory.columns.map((column) => (
                  <td
                    key={column.key}
                    className={resolveClassName(column.cellClassName, row, rowIndex)}
                  >
                    {column.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
