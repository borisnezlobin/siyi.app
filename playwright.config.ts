import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
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
    command: "npm run build && npm run start -- --port 3100",
    url: "http://127.0.0.1:3100/today",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_DIST_DIR: ".next-e2e",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
