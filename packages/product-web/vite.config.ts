import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: mode === "replay" ? "/IntentBench/" : "/",
  define: { __INTENTBENCH_STATIC_REPLAY__: JSON.stringify(mode === "replay") },
  plugins: [
    react(),
    ...(mode === "replay"
      ? [
          {
            name: "replay-policy",
            transformIndexHtml: () => [
              {
                tag: "meta",
                attrs: {
                  "http-equiv": "Content-Security-Policy",
                  content:
                    "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
                },
                injectTo: "head-prepend" as const,
              },
            ],
          },
        ]
      : []),
  ],
  server: { proxy: mode === "replay" ? {} : { "/v1": "http://127.0.0.1:4317" } },
  build: {
    outDir: mode === "replay" ? "../../dist/replay" : "../../dist/product-web",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
}));
