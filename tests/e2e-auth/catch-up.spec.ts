import { expect, test } from "@playwright/test";
import { sessionCookie } from "../support/session-cookie";

const supabaseUrl = process.env.PW_SUPABASE_URL as string;

/**
 * Catch-up was only ever exercised signed out, against demo data. This runs it
 * against rows served as Supabase would serve them, so the data path the
 * feature really uses is the one under test.
 */
test("catch-up picks the person least recently seen, from real rows", async ({
  context,
  page,
  baseURL,
}) => {
  const { adminUser } = await (await fetch(`${supabaseUrl}/__be/fixtures`)).json();
  await fetch(`${supabaseUrl}/__be/user`, {
    method: "POST",
    body: JSON.stringify(adminUser),
  });
  await context.addCookies([sessionCookie(adminUser, { url: baseURL as string })]);

  await page.goto("/today");
  await page.getByRole("heading", { name: "Today" }).waitFor();
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("siyi:catch-up")),
  );

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Good idea" })).toBeVisible();
  // Luis was last seen 60 days ago, Amelia 3 — so Luis is the pick.
  await expect(dialog.getByText("How about reaching out to Luis?")).toBeVisible();
  // Appears twice: as the saved note, and again inside the first opening.
  await expect(
    dialog.getByText("Runs the student radio late-night show.").first(),
  ).toBeVisible();
  // The date keeps its capital month rather than reading "jun 9".
  await expect(dialog.getByText(/^Last interaction [A-Z]/)).toBeVisible();
  // Openings are built from what is actually saved about him.
  await expect(dialog.getByText("Ask how Economics is going lately")).toBeVisible();
  await expect(dialog.getByText("Bring up Econ 201 study group")).toBeVisible();
});
