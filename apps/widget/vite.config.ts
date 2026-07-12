import { resolve } from "node:path";
import { defineConfig } from "vite";

// Full SDK build config (Shadow DOM entry, <40KB budget) lands in Milestone 3 (07-Review-SDK.md).
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/version.ts"),
      name: "Backline",
      fileName: "sdk",
    },
  },
});
