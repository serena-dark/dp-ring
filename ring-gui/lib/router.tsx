/* eslint-disable react-refresh/only-export-components */

import {
  type MouseEvent,
  type ReactNode,
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cleanPath } from "@ring-gui/lib/routes";

export interface RouteLocation {
  pathname: string;
  search: string;
  hash: string | null;
  href: string;
  state: unknown;
}

export interface NavigateTarget {
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  hash?: string | null;
  state?: unknown;
}

interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

interface RouterValue extends RouteLocation {
  query: URLSearchParams;
  buildHref: (to: string | NavigateTarget) => string;
  navigate: (to: string | NavigateTarget, options?: NavigateOptions) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function cleanHash(hash: string): string | null {
  const normalized = hash.replace(/^#/, "").trim();
  return normalized ? normalized : null;
}

function encodeQuery(
  query: NavigateTarget["query"],
  fallbackSearch = "",
): string {
  if (!query) {
    return fallbackSearch;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") {
      continue;
    }
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function buildHrefFromTarget(
  to: string | NavigateTarget,
  current: Pick<RouteLocation, "pathname" | "search">,
): string {
  if (typeof to === "string") {
    const url = new URL(to, window.location.origin);
    const pathname = cleanPath(url.pathname);
    const hash = cleanHash(url.hash);
    return `${pathname}${url.search}${hash ? `#${hash}` : ""}`;
  }

  const pathname = cleanPath(to.path);
  const search = encodeQuery(to.query, current.search);
  const hash = cleanHash(to.hash ?? "");
  return `${pathname}${search}${hash ? `#${hash}` : ""}`;
}

function getCurrentLocation(): RouteLocation {
  const pathname = cleanPath(window.location.pathname);
  const search = window.location.search ?? "";
  const hash = cleanHash(window.location.hash ?? "");
  return {
    pathname,
    search,
    hash,
    href: `${pathname}${search}${hash ? `#${hash}` : ""}`,
    state: window.history.state?.routeState ?? null,
  };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<RouteLocation>(getCurrentLocation);

  useEffect(() => {
    const handlePopState = () => {
      startTransition(() => {
        setLocation(getCurrentLocation());
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const value = useMemo<RouterValue>(() => {
    const query = new URLSearchParams(location.search);

    return {
      ...location,
      query,
      buildHref: (to) =>
        buildHrefFromTarget(to, {
          pathname: location.pathname,
          search: location.search,
        }),
      navigate: (to, options = {}) => {
        const href = buildHrefFromTarget(to, {
          pathname: location.pathname,
          search: location.search,
        });
        const nextState =
          typeof to === "string"
            ? location.state
            : to.state !== undefined
              ? to.state
              : location.state;

        if (href === location.href && nextState === location.state) {
          return;
        }

        const historyMethod = options.replace ? "replaceState" : "pushState";
        window.history[historyMethod]({ routeState: nextState }, "", href);
        startTransition(() => {
          setLocation(getCurrentLocation());
        });

        if (options.scroll !== false) {
          const workspacePane = document.querySelector<HTMLElement>(".workspace-pane");
          if (href.includes("#")) {
            window.requestAnimationFrame(() => {
              const targetId = cleanHash(window.location.hash);
              if (!targetId) {
                return;
              }

              const element = document.getElementById(targetId);
              element?.scrollIntoView({ block: "start", behavior: "smooth" });
            });
          } else {
            if (workspacePane) {
              workspacePane.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            }
          }
        }
      },
    };
  }, [location]);

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) {
    throw new Error("useRouter must be used inside RouterProvider.");
  }
  return value;
}

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.button !== 0
  );
}

export function AppLink({
  to,
  children,
  className,
  onClick,
}: {
  to: string | NavigateTarget;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { pathname, buildHref, navigate } = useRouter();
  const href = buildHref(to);
  const targetUrl = new URL(href, window.location.origin);
  const currentPath = cleanPath(pathname);
  const targetPath = cleanPath(targetUrl.pathname);
  const isActive =
    currentPath === targetPath ||
    (targetPath !== "/" && currentPath.startsWith(`${targetPath}/`));

  return (
    <a
      href={href}
      className={[className, isActive ? "is-active" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-current={isActive ? "page" : undefined}
      onClick={(event) => {
        if (isModifiedEvent(event)) {
          return;
        }

        event.preventDefault();
        navigate(to);
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}
