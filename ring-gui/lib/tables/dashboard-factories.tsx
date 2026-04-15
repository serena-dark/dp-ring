import {
  createDateTimeColumn,
  createLinkColumn,
  createStatusBadgeColumn,
  createTextColumn,
} from "@ring-gui/lib/tables/column-factories";
import { createTableFactory } from "@ring-gui/lib/tables/core";
import type { Session } from "@ring-gui/types/api";

export function createDashboardRecentSessionsTableFactory() {
  return createTableFactory<Session>({
    getRowKey: (item) => item.id,
    columns: [
      createLinkColumn({
        key: "id",
        header: "ID",
        to: (item) => `/sessions/${item.id}`,
        label: (item) => item.id,
      }),
      createStatusBadgeColumn({
        key: "status",
        header: "Status",
        value: (item) => item.status,
      }),
      createTextColumn({
        key: "requirement",
        header: "Requirement",
        value: (item) => item.data.requirement_id,
      }),
      createDateTimeColumn({
        key: "updated",
        header: "Updated",
        value: (item) => item.updated_at,
      }),
    ],
  });
}
