import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".next/**", ".open-next/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    plugins: { "@next/next": nextPlugin },
    rules: nextPlugin.configs.recommended.rules,
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
