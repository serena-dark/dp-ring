import type { ComponentType } from "react";
import {
  IconBook2,
  IconClockPlay,
  IconFileDescription,
  IconLayoutDashboard,
  IconMessage2Exclamation,
  IconRoute,
  IconSettings,
} from "@tabler/icons-react";
import type { ArtifactType } from "@ring-gui/types/api";

export interface NavItem {
  label: string;
  path: string;
  depth?: number;
  icon?: ComponentType<{
    size?: number | string;
    stroke?: number | string;
    className?: string;
  }>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: IconLayoutDashboard,
  },
  {
    label: "Requirements",
    path: "/requirements",
    icon: IconFileDescription,
  },
  {
    label: "Sessions",
    path: "/sessions",
    icon: IconClockPlay,
  },
  {
    label: "Dispatcher",
    path: "/dispatcher",
    depth: 1,
  },
  {
    label: "Tasks",
    path: "/tasks",
    depth: 1,
  },
  {
    label: "Workflow",
    path: "/workflows",
    icon: IconRoute,
  },
  {
    label: "Ranking",
    path: "/workflows/rankings",
    depth: 1,
  },
  {
    label: "Knowledge",
    path: "/knowledge",
    icon: IconBook2,
  },
  {
    label: "Feedback",
    path: "/feedback",
    icon: IconMessage2Exclamation,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: IconSettings,
  },
];

export type RouteKey =
  | "dashboard"
  | "dispatcher"
  | "sessions"
  | "session-detail"
  | "requirements"
  | "requirement-detail"
  | "tasks"
  | "task-detail"
  | "workflows"
  | "workflow-rankings"
  | "workflow-detail"
  | "knowledge"
  | "feedback"
  | "settings";

interface RouteDefinition {
  key: RouteKey;
  title: string;
  pattern: string;
}

export interface MatchedRoute {
  key: RouteKey;
  title: string;
  params: Record<string, string>;
}

const ROUTES: RouteDefinition[] = [
  { key: "dashboard", title: "Dashboard", pattern: "/" },
  { key: "dispatcher", title: "Dispatcher", pattern: "/dispatcher" },
  { key: "sessions", title: "Sessions", pattern: "/sessions" },
  { key: "session-detail", title: "Session Detail", pattern: "/sessions/:id" },
  { key: "requirements", title: "Requirements", pattern: "/requirements" },
  {
    key: "requirement-detail",
    title: "Requirement Detail",
    pattern: "/requirements/:id",
  },
  { key: "tasks", title: "Tasks", pattern: "/tasks" },
  { key: "task-detail", title: "Task Detail", pattern: "/tasks/:id" },
  { key: "workflows", title: "Workflows", pattern: "/workflows" },
  {
    key: "workflow-rankings",
    title: "Workflow Ranking",
    pattern: "/workflows/rankings",
  },
  {
    key: "workflow-detail",
    title: "Workflow Detail",
    pattern: "/workflows/:id",
  },
  { key: "knowledge", title: "Knowledge Base", pattern: "/knowledge" },
  { key: "feedback", title: "Feedback", pattern: "/feedback" },
  { key: "settings", title: "Settings", pattern: "/settings" },
];

export function cleanPath(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function matchPattern(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternParts = cleanPath(pattern).split("/").filter(Boolean);
  const pathParts = cleanPath(pathname).split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (const [index, patternPart] of patternParts.entries()) {
    const pathPart = pathParts[index];
    if (!pathPart) {
      return null;
    }

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

export function matchRoute(pathname: string): MatchedRoute | null {
  const normalized = cleanPath(pathname);

  for (const route of ROUTES) {
    const params = matchPattern(route.pattern, normalized);
    if (params) {
      return {
        key: route.key,
        title: route.title,
        params,
      };
    }
  }

  return null;
}

export function artifactPath(type: ArtifactType | string, id: string): string | null {
  switch (type) {
    case "requirement":
      return `/requirements/${id}`;
    case "session":
      return `/sessions/${id}`;
    case "task":
      return `/tasks/${id}`;
    case "workflow":
      return `/workflows/${id}`;
    default:
      return null;
  }
}
