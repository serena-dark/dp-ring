import { useContext } from "react";
import { ThemeContext } from "@ring-gui/lib/theme/context";
import type { ThemeContextValue } from "@ring-gui/lib/theme/types";

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return value;
}
