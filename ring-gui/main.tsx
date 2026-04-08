/**
 * Ring GUI entry point.
 *
 * TODO: Once routing is added, replace <App /> with a router provider.
 *       See ring-gui/TODOS.md for the full implementation plan.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
