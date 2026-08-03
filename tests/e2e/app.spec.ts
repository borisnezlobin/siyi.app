import { expect, test } from "@playwright/test";

test("the public homepage explains the product and offers clear entry points", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Remember more than a name." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start your circle" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "I already have an account" }),
  ).toBeVisible();
});

test("Today prioritizes actionable reminders", async ({ page }) => {
  await page.goto("/today");

  await expect(
    page.getByRole("heading", { name: "Who’s on your mind?" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready for a hello" })).toBeVisible();
  await expect(page.getByText("Birthdays soon")).toBeVisible();
  await expect(page.getByText("Loose ends")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("a quick interaction can be saved with a type and one confirmation", async ({
  page,
}) => {
  await page.goto("/today");
  await page.getByRole("button", { name: "Log an interaction with Luis" }).click();
  await page.getByRole("button", { name: "Coffee" }).click();
  await page.getByRole("button", { name: "Save interaction" }).click();

  await expect(page.getByRole("button", { name: "Logged" })).toBeVisible();
});

test("fast capture keeps advanced fields collapsed", async ({ page }) => {
  await page.goto("/people/new");

  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Instagram", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Phone", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Where did you meet?", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Short note", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Major", { exact: true })).not.toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill("Jordan Lee");
  await page.getByLabel("Instagram", { exact: true }).fill("instagram.com/Jordan.Lee/");
  await page.getByLabel("Where did you meet?", { exact: true }).fill("Library lobby");
  await page.getByRole("button", { name: "Save person" }).click();

  await expect(page).toHaveURL(/\/people\?added=1/);
  await expect(page.getByText("Person saved.")).toBeVisible();
});

test("authentication offers magic links without forcing a password", async ({
  page,
}) => {
  await page.goto("/auth");

  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);

  await page.getByLabel("Email address").fill("alex@example.edu");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
});

test("authentication supports password sign in, signup, and recovery", async ({
  page,
}) => {
  await page.goto("/auth?method=password");

  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with password" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByLabel("Confirm password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
});

test("a signed-in user can create a password without an email link", async ({
  page,
}) => {
  await page.goto("/settings");

  await page.getByLabel("New password").fill("correct-horse-battery");
  await page.getByLabel("Confirm password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Save password" }).click();

  await expect(
    page.getByText("Password saved. You can use it the next time you sign in."),
  ).toBeVisible();
});

test("people can be searched by contextual notes", async ({ page }) => {
  await page.goto("/people");
  await page.getByRole("searchbox", { name: "Search people" }).fill("pollinators");

  await expect(
    page.locator('a[href="/people/20000000-0000-4000-8000-000000000003"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('a[href="/people/20000000-0000-4000-8000-000000000001"]').first(),
  ).not.toBeVisible();
});
