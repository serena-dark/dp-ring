import "./styles.css";
import { Layout } from "@ring-gui/components/Layout";
import { renderRoute } from "@ring-gui/lib/page-renderer";
import { NotificationsProvider } from "@ring-gui/lib/notifications";
import { RouterProvider, useRouter } from "@ring-gui/lib/router";
import { matchRoute } from "@ring-gui/lib/routes";

function AppShell() {
  const { pathname } = useRouter();
  const route = matchRoute(pathname);
  const view = renderRoute(route);

  return (
    <Layout title={view.title}>
      {view.content}
    </Layout>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <NotificationsProvider>
        <AppShell />
      </NotificationsProvider>
    </RouterProvider>
  );
}
