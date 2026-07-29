import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.astro/**",
      "**/coverage/**",
      "**/.changeset/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [tseslint.configs.recommended],
  },
  astro.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
