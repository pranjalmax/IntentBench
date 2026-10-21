import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: { proxy: { "/v1": "http://127.0.0.1:4317" } },
  build: { outDir: "../../dist/product-web", emptyOutDir: true, assetsInlineLimit: 0 },
});
