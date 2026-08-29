import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

// Pulls the numbers the bi-weekly SEO run reads, and prints them as JSON.
// Run with:
//   node scripts/fetch-search-console.mjs
//   node scripts/fetch-search-console.mjs --weeks 4 --site https://www.siyi.app/
//
// The loop in seo/LOOP.md used to get this over a local MCP server. A scheduled
// run happens where that server does not exist, so the data comes from here
// instead: a service account, signed in with nothing but node:crypto, so the
// web app gains no dependency for a script it never calls.
//
// Two windows are always fetched, not one. Every question the loop asks is
// about movement — did the home page win its brand query, did a /for/ page pick
// up impressions — and a single window cannot answer any of them.
//
// Credentials come from GSC_SERVICE_ACCOUNT_JSON (the key inline, for a
// scheduled run whose secrets are environment variables) or from
// GSC_SERVICE_ACCOUNT_FILE (a path, for a person running this by hand). The
// service account's client_email needs read access on the property, added under
// Settings > Users and permissions in Search Console.

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const readonlyScope = "https://www.googleapis.com/auth/webmasters.readonly";
const searchAnalyticsRowLimit = 500;

function parseArguments(argv) {
  const options = { site: "https://www.siyi.app/", weeks: 4 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--site") options.site = argv[index + 1];
    if (argv[index] === "--weeks") options.weeks = Number(argv[index + 1]);
  }
  if (!Number.isInteger(options.weeks) || options.weeks < 1) {
    throw new Error("--weeks must be a positive whole number of weeks.");
  }
  return options;
}

function loadServiceAccount() {
  const inline = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  const path = process.env.GSC_SERVICE_ACCOUNT_FILE?.trim();
  const raw = inline || (path ? readFileSync(path, "utf8") : "");
  if (!raw) {
    throw new Error(
      "Set GSC_SERVICE_ACCOUNT_JSON to the key itself, or GSC_SERVICE_ACCOUNT_FILE to a path to it.",
    );
  }

  let account;
  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error("The service account credentials are not valid JSON.");
  }
  if (!account.client_email || !account.private_key) {
    throw new Error(
      "The service account JSON is missing client_email or private_key.",
    );
  }
  return account;
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function requestAccessToken(account) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: account.client_email,
    scope: readonlyScope,
    aud: tokenEndpoint,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };

  const signingInput = `${base64Url(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  )}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const assertion = `${signingInput}.${signer
    .sign(account.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Google refused the service account: ${body.error_description || body.error || response.status}`,
    );
  }
  return body.access_token;
}

function isoDate(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

// Search Console finalises a day's numbers a couple of days late, so a window
// ending today is always short. Both windows end three days back, which keeps
// them the same shape as each other — the comparison is the whole point.
function windowFor(weeks, periodsAgo) {
  const days = weeks * 7;
  const lag = 3;
  return {
    startDate: isoDate(lag + days * (periodsAgo + 1)),
    endDate: isoDate(lag + days * periodsAgo + 1),
  };
}

async function querySearchAnalytics(token, site, range, dimension) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: [dimension],
        rowLimit: searchAnalyticsRowLimit,
      }),
    },
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Search Console refused the ${dimension} query: ${body.error?.message || response.status}`,
    );
  }

  return (body.rows || []).map((row) => ({
    [dimension]: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const token = await requestAccessToken(loadServiceAccount());

  const current = windowFor(options.weeks, 0);
  const previous = windowFor(options.weeks, 1);

  const [
    currentQueries,
    currentPages,
    previousQueries,
    previousPages,
  ] = await Promise.all([
    querySearchAnalytics(token, options.site, current, "query"),
    querySearchAnalytics(token, options.site, current, "page"),
    querySearchAnalytics(token, options.site, previous, "query"),
    querySearchAnalytics(token, options.site, previous, "page"),
  ]);

  // An empty current window is the condition LOOP.md refuses to run on, so it
  // is reported as a fact rather than left for the reader to notice.
  const report = {
    site: options.site,
    windowWeeks: options.weeks,
    current: { ...current, queries: currentQueries, pages: currentPages },
    previous: { ...previous, queries: previousQueries, pages: previousPages },
    hasData: currentQueries.length > 0 || currentPages.length > 0,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!report.hasData) {
    process.stderr.write(
      `No impressions in ${current.startDate}..${current.endDate}. LOOP.md says not to run on this.\n`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
