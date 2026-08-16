import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Every route the app navigates to has to be a route the app has.
 *
 * A <Redirect href="/marketing-consent" /> survived to main pointing at a
 * screen nobody ever wrote, and because it sat behind a condition that was
 * always true, signing in led straight to it. typedRoutes is supposed to catch
 * this and does not when the generated types are not on disk — which is the
 * normal state of a fresh checkout, and was the state of CI.
 */

const APP_DIR = join(__dirname, "..", "app");
const SRC_DIR = join(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** `(app)/(tabs)/today.tsx` is reached as `/today`: groups are not path parts. */
function routeFromFile(file: string): string | null {
  const rel = relative(APP_DIR, file).replace(/\\/g, "/");
  if (!rel.endsWith(".tsx")) return null;
  const withoutExtension = rel.slice(0, -".tsx".length);
  const segments = withoutExtension
    .split("/")
    .filter((segment) => !/^\(.*\)$/.test(segment));
  if (segments.at(-1) === "_layout") return null;
  if (segments.at(-1) === "index") segments.pop();
  return `/${segments.join("/")}`;
}

/** A dynamic segment matches anything that is not a slash. */
function routeMatcher(route: string): RegExp {
  const pattern = route
    .split("/")
    .map((segment) =>
      /^\[.*\]$/.test(segment)
        ? "[^/]+"
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${pattern}$`);
}

function navigationTargets(): { target: string; file: string }[] {
  const found: { target: string; file: string }[] = [];
  for (const file of walk(SRC_DIR)) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /(?:href=|\bpush\(|\breplace\()["`](\/[^"`]*)["`]/g,
    )) {
      // A template hole stands in for whatever id is being opened.
      found.push({
        target: match[1].replace(/\$\{[^}]*\}/g, "placeholder"),
        file: relative(SRC_DIR, file),
      });
    }
  }
  return found;
}

describe("the routes the app sends people to", () => {
  const routes = walk(APP_DIR)
    .map(routeFromFile)
    .filter((route): route is string => route !== null);
  const matchers = routes.map(routeMatcher);

  it("finds the screens on disk, so the test is testing something", () => {
    expect(routes).toContain("/auth");
    expect(routes).toContain("/today");
    expect(routes).toContain("/people/[id]/edit");
  });

  it("has a screen behind every link, redirect and push", () => {
    const targets = navigationTargets();
    expect(targets.length).toBeGreaterThan(5);

    const broken = targets.filter(
      ({ target }) => !matchers.some((matcher) => matcher.test(target)),
    );

    expect(
      broken.map(({ target, file }) => `${target} (from ${file})`),
    ).toEqual([]);
  });
});
