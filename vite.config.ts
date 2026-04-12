import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const apiProxy = {
  "/api": {
    target: "http://localhost:3100",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ring-gui": resolve(__dirname, "ring-gui"),
    },
  },
  server: {
    // Proxy API calls to the ring backend during development
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
});
