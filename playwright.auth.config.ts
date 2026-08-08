import { defineConfig, devices } from "@playwright/test";

/**
 * The signed-in suite.
 *
 * The main config runs everything signed out against demo data, which left
 * every authenticated page — settings, your card, notifications, admin —
 * without a single test through the real server. This one boots Next against a
 * stub Supabase (tests/support/fake-supabase.mjs), so middleware, the
 * @supabase/ssr client, cookies and HTTP are all the real thing and only the
 * auth service and database are stood in for.
 */
const basePort =
  Number(process.env.PLAYWRIGHT_AUTH_PORT) ||
  3600 +
    (Math.abs(
      [...process.cwd()].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 11),
    ) %
      300);

const supabasePort = basePort + 1;
const supabaseUrl = `http://127.0.0.1:${supabasePort}`;

// Handed to the specs, which fetch their fixtures from the stub rather than
// keeping a second copy of them.
process.env.PW_SUPABASE_URL = supabaseUrl;

// Kept in step with adminUser.id in tests/support/fake-supabase.mjs.
const adminUserId = "00000000-0000-4000-8000-00000000ad11";

export default defineConfig({
  testDir: "./tests/e2e-auth",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${basePort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `FAKE_SUPABASE_PORT=${supabasePort} node tests/support/fake-supabase.mjs`,
      url: `${supabaseUrl}/auth/v1/user`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run build && npm run start -- --port ${basePort}`,
      url: `http://127.0.0.1:${basePort}/auth`,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "stub-publishable-key",
        SUPABASE_SECRET_KEY: "stub-secret-key",
        ADMIN_USER_IDS: adminUserId,
        NEXT_DIST_DIR: `.next-auth-${basePort}`,
      },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
