import { expect, test } from "@playwright/test";
import { publicPages } from "@/lib/public-pages";

const pages = Object.entries(publicPages);

for (const [key, page] of pages) {
  test(`the ${key} page shares its own Open Graph image`, async ({
    page: browserPage,
    request,
  }) => {
    await browserPage.goto(page.path);

    const imageUrl = await browserPage
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(imageUrl, `${page.path} is missing an og:image`).toBeTruthy();

    // Each page must point at the route generated beside it, not inherit the
    // one from a parent segment.
    const expectedPrefix =
      page.path === "/" ? "/opengraph-image" : `${page.path}/opengraph-image`;
    const { pathname, search } = new URL(imageUrl as string);
    expect(pathname).toBe(expectedPrefix);

    const response = await request.get(`${pathname}${search}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");

    const body = await response.body();
    // A blank or errored card still returns 200, so the byte size and the PNG
    // signature are what actually prove an image came back.
    expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(body.byteLength).toBeGreaterThan(10_000);
  });
}

test("every public page's Twitter card image matches its Open Graph one", async ({
  page,
}) => {
  for (const [, publicPage] of pages) {
    await page.goto(publicPage.path);

    const twitterImage = await page
      .locator('meta[name="twitter:image"]')
      .getAttribute("content");
    const expectedPrefix =
      publicPage.path === "/"
        ? "/twitter-image"
        : `${publicPage.path}/twitter-image`;

    expect(twitterImage, `${publicPage.path} is missing a twitter:image`).toBeTruthy();
    expect(new URL(twitterImage as string).pathname).toBe(expectedPrefix);
  }
});
