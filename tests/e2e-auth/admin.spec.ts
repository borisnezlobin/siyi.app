import { expect, test, type BrowserContext } from "@playwright/test";
import { sessionCookie } from "../support/session-cookie";

const supabaseUrl = process.env.PW_SUPABASE_URL as string;

type StubUser = { id: string; email: string };

async function fixtures(): Promise<{ adminUser: StubUser; plainUser: StubUser }> {
  const response = await fetch(`${supabaseUrl}/__be/fixtures`);
  return response.json();
}

async function signIn(
  context: BrowserContext,
  user: StubUser | null,
  baseURL: string,
) {
  await context.clearCookies();
  // The stub answers /auth/v1/user with whoever is set here, which is what
  // supabase-ssr calls to turn the cookie into a verified user.
  await fetch(`${supabaseUrl}/__be/user`, {
    method: "POST",
    body: user ? JSON.stringify(user) : "",
  });
  if (user) {
    await context.addCookies([sessionCookie(user, { url: baseURL })]);
  }
}

/**
 * The first tests in this repo that run as a signed-in user. Everything on the
 * app's side is real — middleware, the @supabase/ssr client, cookies, HTTP,
 * the allowlist, the aggregation and the dashboard — and only the auth service
 * and the database are stubbed.
 */
test.describe("/admin over a real signed-in request", () => {
  test("an allowlisted admin gets the console, with the real aggregates", async ({
    context,
    page,
    baseURL,
  }) => {
    const { adminUser } = await fixtures();
    await signIn(context, adminUser, baseURL as string);

    const response = await page.goto("/admin");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByText("How Siyi is doing")).toBeVisible();

    // Three profiles; 125 people between them; one live web subscription and
    // one revoked native one, so exactly one account counts as push-enabled.
    await expect(page.getByText("Total users")).toBeVisible();
    await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Contacts saved")).toBeVisible();
    await expect(page.getByText("125", { exact: true })).toBeVisible();
  });

  test("the segment counts are the ones the data really supports", async ({
    context,
    page,
    baseURL,
  }) => {
    const { adminUser } = await fixtures();
    await signIn(context, adminUser, baseURL as string);
    await page.goto("/admin");

    const segments = page.getByLabel("Who sees it");
    await expect(segments).toBeVisible();
    // u-2 alone has 100+ contacts. Only u-1 has a live subscription: u-3's
    // native one is revoked, which is the case a naive count gets wrong.
    // Two are quiet — u-3 has done nothing since signing up 200 days ago, and
    // u-2's most recent person was added 35 days ago, which is past the line.
    await expect(segments.locator("option", { hasText: "Everyone (3)" })).toHaveCount(1);
    await expect(
      segments.locator("option", { hasText: "100 or more contacts (1)" }),
    ).toHaveCount(1);
    await expect(
      segments.locator("option", { hasText: "Push turned on (1)" }),
    ).toHaveCount(1);
    await expect(
      segments.locator("option", { hasText: "Quiet for 30 days (2)" }),
    ).toHaveCount(1);
  });

  test("a signed-in user who is not on the allowlist cannot tell it is there", async ({
    context,
    page,
    baseURL,
  }) => {
    const { plainUser } = await fixtures();
    await signIn(context, plainUser, baseURL as string);

    const response = await page.goto("/admin");
    const adminBody = await page.locator("body").innerText();

    expect(response?.status()).toBe(404);

    const madeUp = await page.goto("/definitely-not-a-real-page-xyz");
    expect(madeUp?.status()).toBe(404);
    expect(await page.locator("body").innerText()).toBe(adminBody);
  });

  test("the admin endpoints answer an ordinary signed-in user with nothing", async ({
    context,
    baseURL,
    request,
  }) => {
    const { plainUser } = await fixtures();
    await signIn(context, plainUser, baseURL as string);

    for (const path of ["/api/admin/stats", "/api/admin/announcements"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
      expect(await response.text()).toBe("");
    }
  });
});
