import { Layout } from "@ring-gui/components/Layout";
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

export function renderRoute(route: MatchedRoute | null) {
  if (!route) {
    return (
      <Layout title="Not Found">
        <NotFound />
      </Layout>
    );
  }

  switch (route.key) {
    case "dashboard":
      return (
        <Layout title={route.title}>
          <Dashboard />
        </Layout>
      );
    case "dispatcher":
      return (
        <Layout title={route.title}>
          <Dispatcher />
        </Layout>
      );
    case "sessions":
      return (
        <Layout title={route.title}>
          <SessionList />
        </Layout>
      );
    case "session-detail":
      return (
        <Layout title={`${route.title} / ${route.params.id}`}>
          <SessionDetail id={route.params.id} />
        </Layout>
      );
    case "requirements":
      return (
        <Layout title={route.title}>
          <RequirementList />
        </Layout>
      );
    case "requirement-detail":
      return (
        <Layout title={`${route.title} / ${route.params.id}`}>
          <RequirementDetail id={route.params.id} />
        </Layout>
      );
    case "tasks":
      return (
        <Layout title={route.title}>
          <TaskList />
        </Layout>
      );
    case "task-detail":
      return (
        <Layout title={`${route.title} / ${route.params.id}`}>
          <TaskDetail id={route.params.id} />
        </Layout>
      );
    case "workflows":
      return (
        <Layout title={route.title}>
          <WorkflowList />
        </Layout>
      );
    case "workflow-rankings":
      return (
        <Layout title={route.title}>
          <Leaderboard />
        </Layout>
      );
    case "workflow-detail":
      return (
        <Layout title={`${route.title} / ${route.params.id}`}>
          <WorkflowDetail id={route.params.id} />
        </Layout>
      );
    case "knowledge":
      return (
        <Layout title={route.title}>
          <Knowledge />
        </Layout>
      );
    case "feedback":
      return (
        <Layout title={route.title}>
          <FeedbackList />
        </Layout>
      );
    case "settings":
      return (
        <Layout title={route.title}>
          <Settings />
        </Layout>
      );
    default:
      return (
        <Layout title="Not Found">
          <NotFound />
        </Layout>
      );
  }
}
