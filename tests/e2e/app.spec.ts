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

  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(
    page.getByText("Who did you talk to today?", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Time-sensitive" })).toBeVisible();
  await expect(page.getByText("Overdue first, then what’s coming up")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Have you checked in recently?" }),
  ).toBeVisible();
  // The same sections, in the same order, as the phone's Today tab.
  await expect(page.getByText("need attention")).toBeVisible();
  await expect(page.getByText("coming up", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("the mobile add button opens a tray that separates the two verbs", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "The action tray is the mobile navigation pattern.",
  );
  await page.goto("/today");
  await page.getByRole("button", { name: "Open quick actions" }).click();

  await expect(page.getByRole("link", { name: /Add a person/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Add a follow-up/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Add an update/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Log an interaction/ }).click();

  const sheet = page.locator("dialog[open]");
  await expect(
    sheet.getByRole("heading", { name: "Who did you see?" }),
  ).toBeVisible();
  await sheet.getByRole("button", { name: /Amelia/ }).click();
  await sheet.getByRole("button", { name: "Coffee", exact: true }).click();
  await sheet.getByRole("button", { name: "Log interaction" }).click();

  await expect(sheet.getByRole("button", { name: "Saved" })).toBeVisible();
});

test("several people can be logged as one evening out", async ({
  page,
}, testInfo) => {
  await page.goto("/today");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open quick actions" }).click();
    await page.getByRole("button", { name: /Log an interaction/ }).click();
  } else {
    await page.getByRole("button", { name: "Log interaction" }).click();
  }

  const sheet = page.locator("dialog[open]");
  const amelia = sheet.getByRole("button", { name: /Amelia/ });
  const luis = sheet.getByRole("button", { name: /Luis/ });
  await amelia.click();
  await luis.click();
  await expect(amelia).toHaveAttribute("aria-pressed", "true");
  await expect(luis).toHaveAttribute("aria-pressed", "true");

  // Who you saw is the whole entry: nothing else has to be filled in.
  await sheet.getByRole("button", { name: "Log interaction" }).click();
  await expect(sheet.getByRole("button", { name: "Saved" })).toBeVisible();
});

test("an update is written without claiming you saw them", async ({
  page,
}, testInfo) => {
  await page.goto("/today");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open quick actions" }).click();
    await page.getByRole("button", { name: /Add an update/ }).click();
  } else {
    await page.getByRole("button", { name: "Add update" }).click();
  }

  const sheet = page.locator("dialog[open]");
  await expect(
    sheet.getByRole("heading", { name: "What did you find out?" }),
  ).toBeVisible();
  await expect(sheet.getByText(/does not count as seeing them/i)).toBeVisible();

  await sheet.getByLabel("Who is this about?").fill("luis");
  await sheet.getByRole("option", { name: /Luis/ }).first().click();
  await sheet.getByLabel("What did you learn?").fill("Is interested in photography");
  await sheet.getByRole("button", { name: "Save update" }).click();

  await expect(sheet.getByRole("button", { name: "Saved" })).toBeVisible();
});

test("the capture sheet does not shift while the picker is used", async ({
  page,
}, testInfo) => {
  await page.goto("/today");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open quick actions" }).click();
    await page.getByRole("button", { name: /Add a follow-up/ }).click();
  } else {
    await page.getByRole("button", { name: "Follow-up", exact: true }).click();
  }

  const sheet = page.locator("dialog[open]");
  const picker = sheet.getByTestId("person-picker");
  const below = sheet.getByLabel("Follow-up");
  const search = sheet.getByLabel("Person");

  // The sheet scales as it opens, so measuring has to wait for it to settle.
  await sheet.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );

  // Measured relative to the picker so that focusing a field, which can scroll
  // the sheet, is not mistaken for the layout moving.
  async function layout() {
    const pickerBox = (await picker.boundingBox())!;
    const belowBox = (await below.boundingBox())!;
    return {
      height: Math.round(pickerBox.height),
      gap: Math.round(belowBox.y - pickerBox.y),
    };
  }

  const closed = await layout();

  // Opening the suggestions must float them over what follows, not shove it
  // down the page.
  await search.click();
  await expect(sheet.getByRole("listbox")).toBeVisible();
  expect(await layout()).toEqual(closed);

  await search.fill("ame");
  await expect(sheet.getByRole("option", { name: /Amelia/ })).toBeVisible();
  expect(await layout()).toEqual(closed);

  // And the chosen person has to occupy exactly the space the search box did.
  await sheet.getByRole("option", { name: /Amelia/ }).first().click();
  await expect(
    sheet.getByRole("button", { name: /Choose someone other than/ }),
  ).toBeVisible();
  expect(await layout()).toEqual(closed);
});

test("follow-ups are shaped by when they land, not one flat list", async ({
  page,
}) => {
  await page.goto("/follow-ups");

  const distribution = page.getByRole("region", {
    name: "How your follow-ups are spread out",
  });
  await expect(distribution.getByRole("link", { name: /Overdue/ })).toBeVisible();
  await expect(distribution.getByRole("link", { name: /This week/ })).toBeVisible();
  await expect(distribution.getByRole("link", { name: /Later/ })).toBeVisible();

  // Demo data: one overdue, one due today, one four days out, one done.
  await expect(distribution.getByRole("link", { name: "1 Overdue" })).toBeVisible();
  await expect(distribution.getByRole("link", { name: "1 Today" })).toBeVisible();
  await expect(distribution.getByRole("link", { name: "1 This week" })).toBeVisible();
  await expect(distribution.getByRole("link", { name: "0 Later" })).toBeVisible();

  for (const heading of ["Overdue", "Today", "This week", "Later"]) {
    await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
  }
  await expect(
    page.getByText("Nothing scheduled further out."),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("completing a follow-up keeps the list from jumping", async ({ page }) => {
  await page.goto("/follow-ups");

  const row = page.getByRole("listitem").filter({
    hasText: "Share the campus garden group chat",
  });
  const before = await row.boundingBox();

  await page
    .getByRole("button", { name: /Mark “Share the campus garden group chat” complete/ })
    .click();

  await expect(
    page.getByRole("button", {
      name: /Mark “Share the campus garden group chat” incomplete/,
    }),
  ).toBeVisible();

  const after = await row.boundingBox();
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
});

test("completed follow-ups stay one tap away", async ({ page }) => {
  await page.goto("/follow-ups");

  await expect(page.getByRole("heading", { name: "Done" })).toHaveCount(0);
  await page.getByRole("button", { name: "Done (1)" }).click();
  await expect(page.getByRole("heading", { name: "Done", level: 2 })).toBeVisible();
  await expect(page.getByText("Send ceramics studio hours")).toBeVisible();
});

test("fast capture keeps advanced fields collapsed", async ({ page }) => {
  await page.goto("/people/new");

  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Instagram", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Phone", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Where did you meet?", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Short note", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Major", { exact: true })).not.toBeVisible();
  await expect(page.getByLabel("University", { exact: true })).not.toBeVisible();

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

  await expect(page.getByRole("button", { name: "Apple", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Google", exact: true })).toBeDisabled();
  await expect(page.getByText("Apple and Google sign-in are coming soon.")).toBeVisible();
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
    page.locator('a[href="/people/amara-okafor-3wqd"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('a[href="/people/amelia-chen-4hkq"]').first(),
  ).not.toBeVisible();
});

test("switching tabs paints immediately instead of waiting on the server", async ({
  page,
}) => {
  await page.goto("/today");
  await page.getByRole("link", { name: "People", exact: true }).first().click();

  // The skeleton or the page itself must appear promptly. Before the loading
  // boundary existed the browser sat on the previous tab until the server
  // answered, which is what made switching feel broken.
  await expect(
    page.locator('[aria-busy="true"]').or(page.getByRole("searchbox", { name: "Search people" })),
  ).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole("searchbox", { name: "Search people" })).toBeVisible();
});

test("the quick facts name the university and the age", async ({ page }) => {
  await page.goto("/people/amelia-chen-4hkq");

  const facts = page.locator("dl");
  await expect(facts.getByText("University", { exact: true })).toBeVisible();
  await expect(facts.getByText("Westmont University")).toBeVisible();
  // The demo birthday is three days out, so the age shown is the one they are
  // still living, not the one they are about to turn.
  await expect(facts.getByText(/^\w+ \d{1,2} · 20$/)).toBeVisible();
});

test("an update can be corrected after it was saved", async ({ page }) => {
  await page.goto("/people/amelia-chen-4hkq");

  await page
    .getByRole("button", { name: /Edit this entry about/ })
    .first()
    .click();

  // Every timeline row carries its own sheet, so assertions scope to the open one.
  const sheet = page.locator("dialog[open]");
  await expect(sheet.getByText(/^Edit (update|interaction)$/)).toBeVisible();
  const note = sheet.getByLabel("Add a note");
  await expect(note).not.toHaveValue("");
  await note.fill("Corrected what we actually talked about");
  await sheet.getByRole("button", { name: "Save changes" }).click();

  await expect(sheet.getByRole("button", { name: "Saved" })).toBeVisible();
});

test("deleting an update asks first", async ({ page }) => {
  await page.goto("/people/amelia-chen-4hkq");
  await page
    .getByRole("button", { name: /Edit this entry about/ })
    .first()
    .click();

  const sheet = page.locator("dialog[open]");
  await sheet.getByRole("button", { name: "Delete this entry" }).click();

  // Real data, so it must never go on a single tap.
  await expect(sheet.getByText(/It will not be recoverable/)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Yes, delete it" })).toBeVisible();
  await sheet.getByRole("button", { name: "Keep it" }).click();
  await expect(sheet.getByRole("button", { name: "Yes, delete it" })).toHaveCount(0);
});

test("naming an entry yourself offers icons rather than emoji", async ({
  page,
}) => {
  await page.goto("/people/amelia-chen-4hkq");
  await page
    .getByRole("button", { name: /Edit this entry about/ })
    .first()
    .click();

  const sheet = page.locator("dialog[open]");
  await expect(sheet.getByRole("button", { name: /Use the climb icon/ })).toHaveCount(0);

  await sheet.getByLabel("What was it?").fill("Went bouldering");
  const icon = sheet.getByRole("button", { name: "Use the climb icon" });
  await expect(icon).toBeVisible();
  await icon.click();
  await expect(icon).toHaveAttribute("aria-pressed", "true");
});

test("the person picker finds someone by typing rather than scrolling", async ({
  page,
}, testInfo) => {
  await page.goto("/today");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open quick actions" }).click();
  }
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: /Add a follow-up/ }).click();
  } else {
    await page.getByRole("button", { name: "Follow-up", exact: true }).click();
  }

  const search = page.getByLabel("Person");
  await search.fill("luis");
  await expect(page.getByRole("option", { name: /Luis/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Amelia/ })).toHaveCount(0);

  // Keyboard has to work: this is a combobox, not a list of buttons.
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.getByRole("button", { name: /Choose someone other than/ })).toBeVisible();
});

test("the edit person page is grouped rather than one long wall", async ({
  page,
}) => {
  await page.goto("/people/amelia-chen-4hkq/edit");

  for (const heading of [
    "Who they are",
    "How to reach them",
    "About them",
    "How you met",
    "Reminders",
  ]) {
    await expect(page.getByText(heading, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/basic info/i)).toHaveCount(0);

  // Collapsed sections still have to be part of the form, or saving silently
  // drops whatever the user could not see.
  await page.getByText("About them", { exact: true }).click();
  await expect(page.getByLabel("Major", { exact: true })).toBeVisible();
  await expect(page.getByLabel("University", { exact: true })).toBeVisible();
});

test("the map places what it can and admits what it cannot", async ({ page }) => {
  await page.goto("/map");

  await expect(page.getByRole("heading", { name: /where/i }).first()).toBeVisible();
  await expect(page.getByText("GeoNames")).toBeVisible();
});

test("adding a person leads the quick actions sheet", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "The action tray is the mobile navigation pattern.",
  );
  await page.goto("/today");
  await page.getByRole("button", { name: "Open quick actions" }).click();

  const addPerson = page.getByRole("link", { name: /Add a person/ });
  await expect(addPerson).toBeVisible();

  // It creates something rather than recording something, so it leads and
  // carries the accent rather than sitting last among the log actions.
  const addPersonBox = await addPerson.boundingBox();
  const logInteraction = await page
    .getByRole("button", { name: /Log an interaction/ })
    .boundingBox();
  expect(addPersonBox!.y).toBeLessThan(logInteraction!.y);
});

test("an unknown share link fails gently and stays out of search results", async ({
  page,
}) => {
  const response = await page.goto(`/s/${"a".repeat(32)}`);

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "This link isn't available." }),
  ).toBeVisible();
  // Expired, revoked and never-existed all read the same, so a guessed token
  // is never confirmed to have once been real.
  await expect(page.getByText(/Shared cards expire/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("a malformed share token gets exactly the same page", async ({ page }) => {
  await page.goto("/s/not-a-real-token");

  await expect(
    page.getByRole("heading", { name: "This link isn't available." }),
  ).toBeVisible();
});

test("robots.txt keeps crawlers away from shared cards", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /s/");
});
