import { defineConfig, devices } from "@playwright/test";

// Each checkout gets its own port, derived from its path, so parallel worktrees
// cannot serve each other's builds.
const port =
  Number(process.env.PLAYWRIGHT_PORT) ||
  3100 +
    (Math.abs(
      [...process.cwd()].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7),
    ) %
      400);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Built once and served, rather than `next dev`. Dev compiles each route on
    // first request, which made assertions time out at random and taught us to
    // distrust the suite.
    command: `npm run build && npm run start -- --port ${port}`,
    url: `http://127.0.0.1:${port}/today`,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_DIST_DIR: `.next-e2e-${port}`,
    },
    // Never reuse. Agent worktrees all ran on one fixed port, so a suite could
    // silently assert against whatever another checkout happened to be serving,
    // and two runs of the same code disagreed.
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
