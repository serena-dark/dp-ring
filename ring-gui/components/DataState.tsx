import type { ReactNode } from "react";

export function DataState({
  loading,
  error,
  empty,
  emptyMessage = "No data.",
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (loading) {
    return <div className="panel state-panel">Loading...</div>;
  }

  if (error) {
    return <div className="panel state-panel is-error">{error}</div>;
  }

  if (empty) {
    return <div className="panel state-panel is-empty">{emptyMessage}</div>;
  }

  return <>{children}</>;
}
