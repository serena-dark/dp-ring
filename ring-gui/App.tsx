import "./styles.css";
import { renderRoute } from "@ring-gui/lib/page-renderer";
import { NotificationsProvider } from "@ring-gui/lib/notifications";
import { RouterProvider, useRouter } from "@ring-gui/lib/router";
import { matchRoute } from "@ring-gui/lib/routes";

function AppShell() {
  const { pathname } = useRouter();
  const route = matchRoute(pathname);
  return renderRoute(route);
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
