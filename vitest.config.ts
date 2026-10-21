import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "packages/*/test/**/*.test.tsx"],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 240_000,
  },
});
