import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // MapLibre worker copied from node_modules (scripts/copy-maplibre-worker.mjs)
    "public/maplibre/**",
    // Agent skills library
    ".claude/**",
    // Supabase Edge Functions (Deno environment)
    "supabase/functions/**",
    // Pitch video — its own package (Remotion), type-checked with `npm run typecheck` in video/
    "video/**",
  ]),
]);

export default eslintConfig;
