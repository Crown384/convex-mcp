import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // ESLint flat config does not automatically ignore Next build artifacts.
  { ignores: ["**/.next/**", "**/out/**", "**/build/**", "**/coverage/**", "convex/_generated/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Node's built-in test runner and Vercel release guard use CommonJS.
  { files: ["**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
];

export default eslintConfig;
