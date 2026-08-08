import { defineConfig } from "vitest/config";

export default defineConfig({
  // Component tests are .tsx; nothing else here needs a JSX transform.
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    // Component tests opt into a DOM with a `@vitest-environment jsdom`
    // docblock; everything else stays on node, which is faster.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/data.ts",
        "src/lib/auth.ts",
        "src/lib/api.ts",
        "src/lib/push.ts",
        "src/lib/supabase/**",
      ],
    },
  },
});
