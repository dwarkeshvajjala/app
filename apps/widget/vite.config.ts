import { resolve } from "node:path";
import { defineConfig } from "vite";

// Snippet-mode delivery is a single <script> tag (07-Review-SDK.md §7.1), so this
// builds an IIFE (self-invoking, no module system assumed on the host page) rather
// than relying on the "umd" format's CJS/AMD branches, which snippet mode never uses.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Backline",
      fileName: () => "sdk.js",
      formats: ["iife"],
    },
    minify: true,
  },
});
