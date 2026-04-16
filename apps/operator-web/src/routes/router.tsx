import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppShell } from "../layouts/AppShell";
import {
  FindingsPage,
  InboxPage,
  InsightsPage,
  ObjectivesPage,
  QueuePage,
  ResourceDetailPage,
  ReviewsPage,
  RunsPage,
  WorkersPage,
} from "./pages";

const rootRoute = createRootRoute({
  component: AppShell,
});

const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: InboxPage,
});

const inboxAliasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "inbox",
  component: InboxPage,
});

const objectivesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "objectives",
  component: ObjectivesPage,
});

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "queue",
  component: QueuePage,
});

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "runs",
  component: RunsPage,
});

const reviewsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "reviews",
  component: ReviewsPage,
});

const findingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "findings",
  component: FindingsPage,
});

const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "insights",
  component: InsightsPage,
});

const workersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "workers",
  component: WorkersPage,
});

const resourceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "resources/$kind/$id",
  component: ResourceDetailPage,
});

const routeTree = rootRoute.addChildren([
  inboxRoute,
  inboxAliasRoute,
  objectivesRoute,
  queueRoute,
  runsRoute,
  reviewsRoute,
  findingsRoute,
  insightsRoute,
  workersRoute,
  resourceDetailRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
