/**
 * Ring GUI entry point.
 *
 * TODO: Once routing is added, replace <App /> with a router provider.
 *       See ring-gui/TODOS.md for the full implementation plan.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@ring-gui/lib/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
