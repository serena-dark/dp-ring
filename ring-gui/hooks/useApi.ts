import {
  type DependencyList,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ApiResponse } from "@ring-gui/types/api";

interface UseApiOptions<T> {
  enabled?: boolean;
  initialData?: T | null;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useApi<T>(
  loader: () => Promise<ApiResponse<T>>,
  deps: DependencyList,
  options: UseApiOptions<T> = {},
): UseApiResult<T> {
  const { enabled = true, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const dependencyKey = useMemo(
    () =>
      JSON.stringify(
        deps.map((value) =>
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value == null
            ? value
            : String(value),
        ),
      ),
    [deps],
  );

  const reload = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await loaderRef.current();
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      const timeoutId = globalThis.setTimeout(() => {
        void reload();
      }, 0);

      return () => {
        globalThis.clearTimeout(timeoutId);
      };
    }
  }, [dependencyKey, enabled, reload]);

  return {
    data,
    loading,
    error,
    reload,
  };
}
