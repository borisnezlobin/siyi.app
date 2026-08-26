import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Creates the account App Review signs in with, and fills it with fictional
// people. Run with:
//   node scripts/seed-review-account.mjs --dry-run
//   node scripts/seed-review-account.mjs
//
// The app is entirely behind a login, so a reviewer with no account sees a
// sign-in screen and nothing else. The address is confirmed here rather than
// mailed, because a reviewer cannot open our inbox and confirmations are on.
//
// Everything below is invented. No real person's name, photo, number or note
// belongs in this account, and the review notes promise Apple as much.
//
// Dates are computed from the moment it runs, so the account still reads as
// overdue-and-upcoming whenever review actually happens. Re-run it if a
// submission sits in the queue long enough to go stale.
//
// The cast matches store/app-store/screenshots so a reviewer comparing the
// listing to the running app sees the same people.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pageSize = 200;

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

function daysFromNow(days) {
  const when = new Date();
  when.setDate(when.getDate() + days);
  return when;
}

function birthdayIn(days, age) {
  // A birthday is a date, not a moment, and the year has to be old enough to
  // read as a person's age rather than as this year's calendar entry.
  const when = daysFromNow(days);
  when.setFullYear(when.getFullYear() - age);
  return when.toISOString().slice(0, 10);
}

// Columns a migration may not have reached yet. Writing them is an improvement,
// failing on them is not: the deploy rule in TODO.md is that code which writes
// pending schema retries without it rather than breaking.
const pendingPersonColumns = [
  "slug",
  "relationship_label",
  "reminders_enabled",
  "university",
];

function buildCast() {
  return [
    {
      full_name: "Jordan Kim",
      preferred_name: "Jordan",
      slug: "jordan-kim-2p4a",
      instagram_username: "jordankmedia",
      phone_number: "(415) 555-0148",
      email: "jordan@example.edu",
      birthday: birthdayIn(96, 21),
      hometown: "Sacramento, California",
      dorm_or_residence: "Birch Hall",
      university: "Westmont University",
      major: "Media studies",
      graduation_year: 2028,
      relationship_strength: 3,
      relationship_label: "Podcast co-conspirator",
      reminders_enabled: true,
      first_met_days_ago: 132,
      first_met_location: "Radio station open house",
      general_notes:
        "Producing a documentary podcast this quarter. Ask how the first interview went.",
      tags: ["Design club"],
      interactions: [
        { type: "coffee", days_ago: 25, note: "Walked through the episode outline." },
        { type: "texted", days_ago: 4, note: "Sent over the mic recommendation." },
      ],
      follow_ups: [
        { text: "Ask Jordan how the first interview went", due_in_days: 0 },
      ],
    },
    {
      full_name: "Liam Osei",
      preferred_name: "Liam",
      slug: "liam-osei-7wr1",
      instagram_username: "liamosei",
      phone_number: "(510) 555-0177",
      email: "liam@example.edu",
      birthday: birthdayIn(211, 22),
      hometown: "Portland, Oregon",
      dorm_or_residence: "Off campus",
      university: "Westmont University",
      major: "Mechanical engineering",
      graduation_year: 2027,
      relationship_strength: 2,
      relationship_label: "Climate hardware friend",
      reminders_enabled: true,
      first_met_days_ago: 218,
      first_met_location: "Engineering career fair",
      general_notes:
        "Recently moved to San Francisco for a climate hardware role. Rides a folding bike everywhere.",
      tags: ["Econ 201"],
      interactions: [
        { type: "meal", days_ago: 52, note: "Dinner before he moved." },
      ],
      follow_ups: [
        { text: "Check in with Liam about the new role", due_in_days: 12 },
      ],
    },
    {
      full_name: "Maya Chen",
      preferred_name: "Maya",
      slug: "maya-chen-4hkq",
      instagram_username: "mayamakes",
      phone_number: "(415) 555-0142",
      email: "maya@example.edu",
      birthday: birthdayIn(2, 22),
      hometown: "Oakland, California",
      dorm_or_residence: "Birch Hall",
      university: "Westmont University",
      major: "Product design",
      graduation_year: 2027,
      relationship_strength: 4,
      relationship_label: "Studio partner in crime",
      reminders_enabled: true,
      first_met_days_ago: 184,
      first_met_location: "Design club kickoff",
      general_notes:
        "Building a playful accessibility toolkit. Loves ceramics, always orders an oat cortado.",
      tags: ["Design club", "Birch Hall"],
      interactions: [
        { type: "class", days_ago: 19, note: "Critique session ran long, in a good way." },
        { type: "party", days_ago: 8, note: "Introduced me to her ceramics cohort." },
      ],
      follow_ups: [
        { text: "Send Maya the ceramics studio link", due_in_days: -1 },
      ],
    },
    {
      full_name: "Priya Raman",
      preferred_name: "Priya",
      slug: "priya-raman-9xt3",
      instagram_username: "priyaruns",
      phone_number: "(408) 555-0119",
      email: "priya@example.edu",
      birthday: birthdayIn(148, 20),
      hometown: "San Jose, California",
      dorm_or_residence: "Cedar Hall",
      university: "Westmont University",
      major: "Public health",
      graduation_year: 2029,
      relationship_strength: 3,
      relationship_label: "Sunday long-run partner",
      reminders_enabled: true,
      first_met_days_ago: 74,
      first_met_location: "Campus 5k",
      general_notes:
        "Starting a student mutual-aid pantry. Training for her first half marathon.",
      tags: ["Econ 201"],
      interactions: [
        { type: "event", days_ago: 11, note: "Volunteered at the pantry launch." },
      ],
      follow_ups: [
        { text: "Wish Priya luck before the half marathon", due_in_days: 7 },
      ],
    },
    {
      full_name: "Sofia Alvarez",
      preferred_name: "Sofia",
      slug: "sofia-alvarez-6bn8",
      instagram_username: "sofiaalvarez",
      phone_number: "(650) 555-0163",
      email: "sofia@example.edu",
      birthday: birthdayIn(37, 21),
      hometown: "Fresno, California",
      dorm_or_residence: "Cedar Hall",
      university: "Westmont University",
      major: "Economics",
      graduation_year: 2028,
      relationship_strength: 2,
      relationship_label: "Econ study group",
      reminders_enabled: true,
      first_met_days_ago: 41,
      first_met_location: "Econ 201 discussion",
      general_notes:
        "Applying to a summer policy fellowship. Keeps a running list of good campus coffee.",
      tags: ["Econ 201"],
      interactions: [
        { type: "class", days_ago: 33, note: "Swapped problem set notes." },
      ],
      follow_ups: [],
    },
  ];
}

async function findUserByEmail(admin, email) {
  const wanted = email.toLowerCase();

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === wanted);
    if (found) return found;
    if (data.users.length < pageSize) return null;
  }
}

async function upsertReviewUser(admin, email, password) {
  const existing = await findUserByEmail(admin, email);

  if (existing) {
    // Resetting the password matters more than it looks: the review notes are
    // generated from the same variables, so the two must not drift apart.
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return { id: existing.id, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, created: true };
}

async function insertPerson(admin, userId, person) {
  const core = {
    user_id: userId,
    full_name: person.full_name,
    preferred_name: person.preferred_name,
    instagram_username: person.instagram_username,
    phone_number: person.phone_number,
    email: person.email,
    birthday: person.birthday,
    hometown: person.hometown,
    dorm_or_residence: person.dorm_or_residence,
    major: person.major,
    graduation_year: person.graduation_year,
    relationship_strength: person.relationship_strength,
    status: "active",
    first_met_at: daysFromNow(-person.first_met_days_ago).toISOString(),
    first_met_location: person.first_met_location,
    general_notes: person.general_notes,
  };

  const optional = {};
  for (const column of pendingPersonColumns) {
    if (person[column] !== undefined) optional[column] = person[column];
  }

  const attempt = await admin
    .from("people")
    .insert({ ...core, ...optional })
    .select("id")
    .single();

  if (!attempt.error) return attempt.data.id;

  // Undefined column means the migration adding it has not run on this project.
  // The person is still worth having; the extra field is not worth failing on.
  if (attempt.error.code !== "42703") throw attempt.error;

  console.warn(
    `  ${person.full_name}: schema is missing ${Object.keys(optional).join(", ")}, inserting without`,
  );

  const retry = await admin
    .from("people")
    .insert(core)
    .select("id")
    .single();
  if (retry.error) throw retry.error;
  return retry.data.id;
}

async function seedPeople(admin, userId, cast) {
  // Clearing first keeps the script re-runnable. person_tags, interactions and
  // follow_ups all cascade from people, so this is one delete, not four.
  const cleared = await admin.from("people").delete().eq("user_id", userId);
  if (cleared.error) throw cleared.error;

  const tagNames = [...new Set(cast.flatMap((person) => person.tags))];
  const tagIds = new Map();

  for (const name of tagNames) {
    const { data, error } = await admin
      .from("tags")
      .upsert({ user_id: userId, name }, { onConflict: "user_id,name" })
      .select("id")
      .single();
    if (error) throw error;
    tagIds.set(name, data.id);
  }

  for (const person of cast) {
    const personId = await insertPerson(admin, userId, person);

    if (person.tags.length > 0) {
      const { error } = await admin.from("person_tags").insert(
        person.tags.map((name) => ({ person_id: personId, tag_id: tagIds.get(name) })),
      );
      if (error) throw error;
    }

    if (person.interactions.length > 0) {
      const { error } = await admin.from("interactions").insert(
        person.interactions.map((interaction) => ({
          person_id: personId,
          user_id: userId,
          type: interaction.type,
          occurred_at: daysFromNow(-interaction.days_ago).toISOString(),
          note: interaction.note,
        })),
      );
      if (error) throw error;
    }

    if (person.follow_ups.length > 0) {
      const { error } = await admin.from("follow_ups").insert(
        person.follow_ups.map((followUp) => ({
          person_id: personId,
          user_id: userId,
          text: followUp.text,
          due_at: daysFromNow(followUp.due_in_days).toISOString(),
        })),
      );
      if (error) throw error;
    }

    console.log(`  ${person.full_name}`);
  }
}

async function main() {
  loadEnvironment();

  const dryRun = process.argv.includes("--dry-run");
  const email = process.env.APP_REVIEW_EMAIL?.trim();
  const password = process.env.APP_REVIEW_PASSWORD?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!email || !password) {
    throw new Error(
      "Set APP_REVIEW_EMAIL and APP_REVIEW_PASSWORD. They are the credentials printed in the App Store review notes.",
    );
  }
  if (!url || !secretKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
  if (password.length < 12) {
    throw new Error("APP_REVIEW_PASSWORD should be at least 12 characters.");
  }

  const cast = buildCast();

  if (dryRun) {
    console.log(`Would seed ${email} on ${url} with ${cast.length} fictional people:`);
    for (const person of cast) {
      const followUps = person.follow_ups.length;
      console.log(
        `  ${person.full_name} — ${person.interactions.length} interaction(s), ${followUps} follow-up(s), birthday ${person.birthday}`,
      );
    }
    console.log("Nothing was written. Re-run without --dry-run to apply.");
    return;
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { id: userId, created } = await upsertReviewUser(admin, email, password);
  console.log(`${created ? "Created" : "Reused"} review account ${email}`);

  // A reviewer who lands in onboarding cannot get to the app the screenshots
  // show, so the account is marked as having finished it.
  const profile = await admin.from("user_profiles").upsert(
    {
      auth_user_id: userId,
      display_name: "App Review",
      email,
      timezone: "America/Los_Angeles",
      onboarding_completed_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );
  if (profile.error) throw profile.error;

  const settings = await admin
    .from("user_settings")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (settings.error) throw settings.error;

  await seedPeople(admin, userId, cast);

  console.log(`Seeded ${cast.length} people. Sign in with ${email} to check it.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
