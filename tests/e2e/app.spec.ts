import { expect, test } from "@playwright/test";

test("the public homepage explains the product and offers clear entry points", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Remember more than a name." }),
  ).toBeVisible();
  await expect(page.getByText("Siyi.app", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Start your circle" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "I already have an account" }),
  ).toBeVisible();
});

test("Today prioritizes actionable reminders", async ({ page }) => {
  await page.goto("/today");

  await expect(
    page.getByRole("heading", { name: "What needs your attention?" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Time-sensitive" })).toBeVisible();
  await expect(page.getByText("Overdue first, then what’s coming up")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A few people to check in on" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("the mobile add button opens an animated quick-action tray", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "The action tray is the mobile navigation pattern.",
  );
  await page.goto("/today");
  await page.getByRole("button", { name: "Open quick actions" }).click();

  await expect(page.getByRole("link", { name: "Person" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Follow-up", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await page.getByLabel("Person").selectOption({ label: "Luis" });
  await page.getByRole("button", { name: "Coffee" }).click();
  await page.getByRole("button", { name: "Save update" }).click();

  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
});

test("a follow-up can be added from quick actions", async ({
  page,
}, testInfo) => {
  await page.goto("/today");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open quick actions" }).click();
    await page
      .getByRole("button", { name: "Follow-up", exact: true })
      .click();
  } else {
    await page
      .getByRole("button", { name: "Follow-up", exact: true })
      .click();
  }

  await page.getByLabel("Person").selectOption({ label: "Maya" });
  await page.getByLabel("Follow-up").fill("Send the studio address");
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await page.getByRole("button", { name: "Save follow-up" }).click();

  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
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

  await expect(page.getByRole("button", { name: "Continue with Apple" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);

  await page.getByLabel("Email address").fill("alex@example.edu");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
});

test("legal pages contain launch-ready policies", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your choices and rights" })).toBeVisible();
  await expect(page.getByText(/do not sell personal information/i)).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of service" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Information about other people" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account deletion" })).toBeVisible();
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
