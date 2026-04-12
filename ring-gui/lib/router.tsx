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

interface RouterValue {
  pathname: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function getCurrentPathname(): string {
  return cleanPath(window.location.pathname);
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(getCurrentPathname);

  useEffect(() => {
    const handlePopState = () => {
      startTransition(() => {
        setPathname(getCurrentPathname());
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const value = useMemo<RouterValue>(
    () => ({
      pathname,
      navigate: (to: string) => {
        const nextPath = cleanPath(to);
        if (nextPath === pathname) {
          return;
        }

        window.history.pushState({}, "", nextPath);
        startTransition(() => {
          setPathname(nextPath);
        });
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      },
    }),
    [pathname],
  );

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
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { pathname, navigate } = useRouter();
  const currentPath = cleanPath(pathname);
  const targetPath = cleanPath(to);
  const isActive =
    currentPath === targetPath ||
    (targetPath !== "/" && currentPath.startsWith(`${targetPath}/`));

  return (
    <a
      href={to}
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
