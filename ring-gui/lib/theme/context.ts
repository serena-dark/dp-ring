import { createContext } from "react";
import type { ThemeContextValue } from "@ring-gui/lib/theme/types";

export const ThemeContext = createContext<ThemeContextValue | null>(null);
