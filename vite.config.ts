import { defineConfig, mergeConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import operatorWebConfig from "./apps/operator-web/vite.config";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const operatorWebRoot = resolve(repoRoot, "apps/operator-web");

export default mergeConfig(
  operatorWebConfig,
  defineConfig({
    root: resolve(repoRoot, "apps/operator-web"),
    envDir: operatorWebRoot,
  }),
);
