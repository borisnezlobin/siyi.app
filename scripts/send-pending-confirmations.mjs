import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Sends a confirmation email to every account whose address was never verified.
// Run with:
//   node scripts/send-pending-confirmations.mjs --dry-run
//   node scripts/send-pending-confirmations.mjs
//
// Accounts signed up while email confirmations were switched off, so their
// addresses are unverified. Supabase refuses to link a Google identity to an
// unverified account and creates a second one instead, which is what this
// clears up: once an address is verified, signing in with Google lands on the
// account that already exists.
//
// Confirmation email goes out through whatever SMTP the project is configured
// with (Resend), and Supabase rate limits that sender, so sends are paced.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pageSize = 200;
const defaultSendsPerHour = 100;

function loadEnvironment() {
  for (const file of [".env.local", ".env"]) {
    let contents;
    try {
      contents = readFileSync(join(repoRoot, file), "utf8");
    } catch {
      continue;
    }

    for (const line of contents.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

function sleep(milliseconds) {
  return new Promise((done) => setTimeout(done, milliseconds));
}

async function listUnconfirmedUsers(admin) {
  const unconfirmed = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });
    if (error) throw new Error(error.message);

    for (const user of data.users) {
      if (user.email && !user.email_confirmed_at) unconfirmed.push(user);
    }

    if (data.users.length < pageSize) return unconfirmed;
  }
}

async function main() {
  loadEnvironment();

  const dryRun = process.argv.includes("--dry-run");
  const sendsPerHour = Number(process.env.CONFIRMATION_SENDS_PER_HOUR) ||
    defaultSendsPerHour;
  const gapMilliseconds = Math.ceil(3_600_000 / sendsPerHour);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://siyi.app").replace(
    /\/$/,
    "",
  );

  if (!url || !secretKey || !publishableKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // Resending a signup confirmation is a public endpoint, so it runs on the
  // publishable key; the secret key is only used to find who needs one.
  const anon = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = await listUnconfirmedUsers(admin);
  console.log(`${users.length} account(s) have an unverified email address.`);

  if (dryRun) {
    for (const user of users) {
      console.log(`  would send to ${user.email} (created ${user.created_at})`);
    }
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const [index, user] of users.entries()) {
    const { error } = await anon.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo: `${appUrl}/auth/callback?next=/today` },
    });

    if (error) {
      failed += 1;
      console.error(`  ${user.email}: ${error.message}`);
    } else {
      sent += 1;
      console.log(`  sent to ${user.email}`);
    }

    if (index < users.length - 1) await sleep(gapMilliseconds);
  }

  console.log(`Done. ${sent} sent, ${failed} failed.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
