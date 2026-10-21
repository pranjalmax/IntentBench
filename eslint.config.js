import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".intentbench-data/**",
      ".intentbench-auth/**",
      "trajectories/**",
      "research/**",
      "third-party/**",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { AbortController: "readonly", structuredClone: "readonly", URL: "readonly" },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { project: "./tsconfig.lint.json", tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-confusing-void-expression": "off",
    },
  },
);
