import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  build: {
    chunkSizeWarningLimit: 700
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"]
  }
});
