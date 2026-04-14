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
  tier: "primary" | "secondary";
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
    tier: "primary",
    icon: IconLayoutDashboard,
  },
  {
    label: "Requirements",
    path: "/requirements",
    tier: "primary",
    icon: IconFileDescription,
  },
  {
    label: "Sessions",
    path: "/sessions",
    tier: "primary",
    icon: IconClockPlay,
  },
  {
    label: "Tasks",
    path: "/tasks",
    tier: "secondary",
  },
  {
    label: "Dispatcher",
    path: "/dispatcher",
    tier: "secondary",
  },
  {
    label: "Workflows",
    path: "/workflows",
    tier: "primary",
    icon: IconRoute,
  },
  {
    label: "Ranking",
    path: "/workflows/rankings",
    tier: "secondary",
  },
  {
    label: "Knowledge",
    path: "/knowledge",
    tier: "primary",
    icon: IconBook2,
  },
  {
    label: "Feedback",
    path: "/feedback",
    tier: "primary",
    icon: IconMessage2Exclamation,
  },
  {
    label: "Settings",
    path: "/settings",
    tier: "primary",
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

export interface PageSectionDescriptor {
  id: string;
  label: string;
}

export interface PageBlueprint {
  routeKey: RouteKey;
  path: string;
  title: string;
  defaultSectionId: string | null;
  sections: PageSectionDescriptor[];
}

interface RouteDefinition {
  key: RouteKey;
  title: string;
  pattern: string;
  blueprint: PageBlueprint;
}

export interface MatchedRoute {
  key: RouteKey;
  title: string;
  params: Record<string, string>;
}

const ROUTES: RouteDefinition[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    pattern: "/",
    blueprint: {
      routeKey: "dashboard",
      path: "/",
      title: "Dashboard",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "records", label: "Recent Sessions" },
        { id: "related", label: "Service Health" },
      ],
    },
  },
  {
    key: "dispatcher",
    title: "Dispatcher",
    pattern: "/dispatcher",
    blueprint: {
      routeKey: "dispatcher",
      path: "/dispatcher",
      title: "Dispatcher",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "records", label: "Dispatch State" },
        { id: "related", label: "Protocol" },
      ],
    },
  },
  {
    key: "sessions",
    title: "Sessions",
    pattern: "/sessions",
    blueprint: {
      routeKey: "sessions",
      path: "/sessions",
      title: "Sessions",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "create", label: "New Session" },
        { id: "records", label: "Session Records" },
      ],
    },
  },
  {
    key: "session-detail",
    title: "Session Detail",
    pattern: "/sessions/:id",
    blueprint: {
      routeKey: "session-detail",
      path: "/sessions/:id",
      title: "Session Detail",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "execution", label: "Execution" },
        { id: "related", label: "Related Records" },
      ],
    },
  },
  {
    key: "requirements",
    title: "Requirements",
    pattern: "/requirements",
    blueprint: {
      routeKey: "requirements",
      path: "/requirements",
      title: "Requirements",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "create", label: "New Requirement" },
        { id: "records", label: "Requirement Records" },
      ],
    },
  },
  {
    key: "requirement-detail",
    title: "Requirement Detail",
    pattern: "/requirements/:id",
    blueprint: {
      routeKey: "requirement-detail",
      path: "/requirements/:id",
      title: "Requirement Detail",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "acceptance", label: "Acceptance" },
        { id: "related", label: "Related Records" },
      ],
    },
  },
  {
    key: "tasks",
    title: "Tasks",
    pattern: "/tasks",
    blueprint: {
      routeKey: "tasks",
      path: "/tasks",
      title: "Tasks",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "create", label: "New Task" },
        { id: "records", label: "Task Records" },
      ],
    },
  },
  {
    key: "task-detail",
    title: "Task Detail",
    pattern: "/tasks/:id",
    blueprint: {
      routeKey: "task-detail",
      path: "/tasks/:id",
      title: "Task Detail",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "execution", label: "Execution" },
        { id: "related", label: "Related Records" },
      ],
    },
  },
  {
    key: "workflows",
    title: "Workflows",
    pattern: "/workflows",
    blueprint: {
      routeKey: "workflows",
      path: "/workflows",
      title: "Workflows",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "filters", label: "Filters" },
        { id: "records", label: "Workflow Records" },
        { id: "related", label: "Rankings" },
      ],
    },
  },
  {
    key: "workflow-rankings",
    title: "Workflow Ranking",
    pattern: "/workflows/rankings",
    blueprint: {
      routeKey: "workflow-rankings",
      path: "/workflows/rankings",
      title: "Workflow Ranking",
      defaultSectionId: "records",
      sections: [
        { id: "filters", label: "Filters" },
        { id: "records", label: "Rankings" },
      ],
    },
  },
  {
    key: "workflow-detail",
    title: "Workflow Detail",
    pattern: "/workflows/:id",
    blueprint: {
      routeKey: "workflow-detail",
      path: "/workflows/:id",
      title: "Workflow Detail",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "records", label: "Steps" },
        { id: "related", label: "Scores" },
      ],
    },
  },
  {
    key: "knowledge",
    title: "Knowledge Base",
    pattern: "/knowledge",
    blueprint: {
      routeKey: "knowledge",
      path: "/knowledge",
      title: "Knowledge Base",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "records", label: "Knowledge" },
        { id: "related", label: "Distillations" },
      ],
    },
  },
  {
    key: "feedback",
    title: "Feedback",
    pattern: "/feedback",
    blueprint: {
      routeKey: "feedback",
      path: "/feedback",
      title: "Feedback",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Summary" },
        { id: "create", label: "New Feedback" },
        { id: "records", label: "Feedback Records" },
      ],
    },
  },
  {
    key: "settings",
    title: "Settings",
    pattern: "/settings",
    blueprint: {
      routeKey: "settings",
      path: "/settings",
      title: "Settings",
      defaultSectionId: "summary",
      sections: [
        { id: "summary", label: "Theme" },
        { id: "openai", label: "OpenAI" },
        { id: "related", label: "Shell" },
      ],
    },
  },
];

export const PAGE_BLUEPRINTS: Record<RouteKey, PageBlueprint> = Object.fromEntries(
  ROUTES.map((route) => [route.key, route.blueprint]),
) as Record<RouteKey, PageBlueprint>;

export function getPageBlueprint(key: RouteKey): PageBlueprint {
  return PAGE_BLUEPRINTS[key];
}

export function getPageDescriptors() {
  return Object.values(PAGE_BLUEPRINTS).map((blueprint) => ({
    route_key: blueprint.routeKey,
    path: blueprint.path,
    title: blueprint.title,
    default_section_id: blueprint.defaultSectionId,
    sections: blueprint.sections.map((section) => ({
      id: section.id,
      label: section.label,
    })),
  }));
}

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
