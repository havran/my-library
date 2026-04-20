import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", ".husky"] },

  // Base config for all TS/TSX
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: { react: { version: "19.1" } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // React 17+ JSX transform — no need to import React
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",

      // Lint rule set: warnings (not errors) for things that need broader cleanup
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Server-side: Node globals, no React/DOM
  {
    files: ["server/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Tests: vitest globals
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "src/test/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Disable stylistic rules that conflict with Prettier
  prettier,
);
