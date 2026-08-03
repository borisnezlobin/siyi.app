import { expect, test } from "@playwright/test";

test("Today prioritizes actionable reminders", async ({ page }) => {
  await page.goto("/today");

  await expect(
    page.getByRole("heading", { name: "Who’s on your mind?" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready for a hello" })).toBeVisible();
  await expect(page.getByText("Birthdays soon")).toBeVisible();
  await expect(page.getByText("Loose ends")).toBeVisible();
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

test("authentication has no password interface and explains magic links", async ({
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
