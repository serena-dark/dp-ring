import { useMemo } from "react";
import { useRouter } from "@ring-gui/lib/router";

export function usePageQuery() {
  const { pathname, query, hash, navigate } = useRouter();

  const values = useMemo(() => Object.fromEntries(query.entries()), [query]);

  function setQuery(
    patch: Record<string, string | null | undefined>,
    options: {
      replace?: boolean;
      scroll?: boolean;
      hashOverride?: string | null;
    } = {},
  ) {
    const next = new URLSearchParams(query);

    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    navigate(
      {
        path: pathname,
        query: Object.fromEntries(next.entries()),
        hash: options.hashOverride === undefined ? hash : options.hashOverride,
      },
      {
        replace: options.replace ?? true,
        scroll: options.scroll ?? false,
      },
    );
  }

  return {
    query,
    values,
    setQuery,
  };
}
