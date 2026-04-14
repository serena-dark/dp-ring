import type { MatchedRoute } from "@ring-gui/lib/routes";
import Dashboard from "@ring-gui/pages/Dashboard";
import Dispatcher from "@ring-gui/pages/Dispatcher";
import FeedbackList from "@ring-gui/pages/FeedbackList";
import Knowledge from "@ring-gui/pages/Knowledge";
import Leaderboard from "@ring-gui/pages/Leaderboard";
import NotFound from "@ring-gui/pages/NotFound";
import RequirementDetail from "@ring-gui/pages/RequirementDetail";
import RequirementList from "@ring-gui/pages/RequirementList";
import Settings from "@ring-gui/pages/Settings";
import SessionDetail from "@ring-gui/pages/SessionDetail";
import SessionList from "@ring-gui/pages/SessionList";
import TaskDetail from "@ring-gui/pages/TaskDetail";
import TaskList from "@ring-gui/pages/TaskList";
import WorkflowDetail from "@ring-gui/pages/WorkflowDetail";
import WorkflowList from "@ring-gui/pages/WorkflowList";
import type { ReactNode } from "react";

export interface RouteView {
  title: string;
  content: ReactNode;
}

export function renderRoute(route: MatchedRoute | null): RouteView {
  if (!route) {
    return {
      title: "Not Found",
      content: <NotFound />,
    };
  }

  switch (route.key) {
    case "dashboard":
      return { title: route.title, content: <Dashboard /> };
    case "dispatcher":
      return { title: route.title, content: <Dispatcher /> };
    case "sessions":
      return { title: route.title, content: <SessionList /> };
    case "session-detail":
      return {
        title: `${route.title} / ${route.params.id}`,
        content: <SessionDetail id={route.params.id} />,
      };
    case "requirements":
      return { title: route.title, content: <RequirementList /> };
    case "requirement-detail":
      return {
        title: `${route.title} / ${route.params.id}`,
        content: <RequirementDetail id={route.params.id} />,
      };
    case "tasks":
      return { title: route.title, content: <TaskList /> };
    case "task-detail":
      return {
        title: `${route.title} / ${route.params.id}`,
        content: <TaskDetail id={route.params.id} />,
      };
    case "workflows":
      return { title: route.title, content: <WorkflowList /> };
    case "workflow-rankings":
      return { title: route.title, content: <Leaderboard /> };
    case "workflow-detail":
      return {
        title: `${route.title} / ${route.params.id}`,
        content: <WorkflowDetail id={route.params.id} />,
      };
    case "knowledge":
      return { title: route.title, content: <Knowledge /> };
    case "feedback":
      return { title: route.title, content: <FeedbackList /> };
    case "settings":
      return { title: route.title, content: <Settings /> };
    default:
      return {
        title: "Not Found",
        content: <NotFound />,
      };
  }
}
