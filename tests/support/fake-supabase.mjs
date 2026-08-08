import { createServer } from "node:http";

/**
 * Just enough Supabase to sign somebody in.
 *
 * Every end-to-end test in this repo runs signed out against demo data, which
 * means no authenticated page has ever been exercised through the real server:
 * real middleware, real @supabase/ssr client, real cookies, real HTTP. This
 * stands in for the two things a local run cannot have — the auth service and
 * the database — and nothing else. The app under test is unmodified.
 *
 * It is deliberately dumb: it does not validate tokens, because what is being
 * tested is the app's behaviour once Supabase says who you are, not Supabase.
 */

export const adminUser = {
  id: "00000000-0000-4000-8000-00000000ad11",
  aud: "authenticated",
  role: "authenticated",
  email: "admin@siyi.test",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  confirmed_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
};

export const plainUser = {
  ...adminUser,
  id: "00000000-0000-4000-8000-0000000000b0",
  email: "nobody@siyi.test",
};

const day = 24 * 60 * 60 * 1000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

/**
 * Three accounts, chosen so every segment lands on a different number and a
 * wrong join shows up as a wrong count rather than a coincidence.
 */
export const tables = {
  user_profiles: [
    { auth_user_id: "u-1", created_at: iso(10 * day) },
    { auth_user_id: "u-2", created_at: iso(40 * day) },
    { auth_user_id: "u-3", created_at: iso(200 * day) },
  ],
  push_subscriptions: [{ user_id: "u-1", revoked_at: null }],
  native_push_subscriptions: [{ user_id: "u-3", revoked_at: iso(day) }],
  interactions: [{ user_id: "u-1", created_at: iso(2 * day) }],
  announcements: [],

  // For the signed-in Today page. PostgREST embeds are returned pre-shaped,
  // because the stub answers with fixture JSON and ignores the select.
  people: [
    {
      id: "p-1",
      user_id: "u-1",
      full_name: "Luis Ortega",
      preferred_name: "Luis",
      profile_photo_url: null,
      instagram_username: "luislistens",
      phone_number: "(510) 555-0188",
      email: null,
      birthday: null,
      hometown: "Lima",
      dorm_or_residence: null,
      university: null,
      major: "Economics",
      graduation_year: null,
      relationship_strength: 2,
      relationship_label: null,
      reminders_enabled: true,
      reminder_interval_days: null,
      status: "active",
      first_met_at: iso(120 * day),
      first_met_location: "Econ 201 study group",
      general_notes: "Runs the student radio late-night show.",
      created_at: iso(120 * day),
      updated_at: iso(120 * day),
      slug: null,
      interactions: [{ occurred_at: iso(60 * day) }],
      person_tags: [],
    },
    {
      id: "p-2",
      user_id: "u-1",
      full_name: "Amelia Chen",
      preferred_name: null,
      profile_photo_url: null,
      instagram_username: null,
      phone_number: null,
      email: "amelia@example.edu",
      birthday: null,
      hometown: null,
      dorm_or_residence: null,
      university: null,
      major: null,
      graduation_year: null,
      relationship_strength: 3,
      relationship_label: null,
      reminders_enabled: true,
      reminder_interval_days: null,
      status: "active",
      first_met_at: iso(30 * day),
      first_met_location: null,
      general_notes: null,
      created_at: iso(30 * day),
      updated_at: iso(30 * day),
      slug: null,
      interactions: [{ occurred_at: iso(3 * day) }],
      person_tags: [],
    },
  ],
  person_contact_methods: [],
  reminders: [],
};

/**
 * One `people` table has to satisfy both readers: the admin aggregates count
 * rows per user, and Today renders them. The filler rows belong to u-2 and
 * were all seen yesterday, so the least-recently-seen person is still Luis.
 */
tables.people.push(
  ...Array.from({ length: 123 }, (unused, index) => ({
    ...tables.people[1],
    id: `p-fill-${index}`,
    user_id: "u-2",
    full_name: `Filler Person ${index}`,
    preferred_name: null,
    email: null,
    created_at: iso(35 * day),
    first_met_at: iso(35 * day),
    interactions: [{ occurred_at: iso(day) }],
  })),
);

function sessionCookieValue(user) {
  const session = {
    access_token: "stub-access-token",
    refresh_token: "stub-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
}

/**
 * @supabase/supabase-js derives the cookie name from the first label of the
 * host, so a server on 127.0.0.1 is always `sb-127-auth-token`.
 */
export function authCookie(user, host = "127.0.0.1") {
  return {
    name: `sb-${host.split(".")[0]}-auth-token`,
    value: sessionCookieValue(user),
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  };
}

export function startFakeSupabase({ port, user = adminUser, rows = tables }) {
  let currentUser = user;

  const server = createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    const send = (status, body) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      });
      response.end(JSON.stringify(body));
    };

    // The harness flips who is signed in without a restart.
    if (url.pathname === "/__be/user" && request.method === "POST") {
      let raw = "";
      request.on("data", (chunk) => (raw += chunk));
      request.on("end", () => {
        currentUser = raw ? JSON.parse(raw) : null;
        send(200, { ok: true });
      });
      return;
    }

    if (url.pathname === "/__be/fixtures") {
      return send(200, { adminUser, plainUser });
    }

    if (url.pathname === "/auth/v1/user") {
      return currentUser
        ? send(200, currentUser)
        : send(401, { message: "invalid claim" });
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.slice("/rest/v1/".length);
      const all = rows[table];
      if (!all) return send(404, { message: `no such table ${table}` });

      // PostgREST paginates with a Range header; anything past the end is an
      // empty page, which is what stops fetchAllRows.
      const range = request.headers.range || "";
      const [fromRaw, toRaw] = range.replace(/^items=/, "").split("-");
      const from = Number.parseInt(fromRaw, 10);
      const to = Number.parseInt(toRaw, 10);
      const page =
        Number.isFinite(from) && Number.isFinite(to)
          ? all.slice(from, to + 1)
          : all;
      return send(200, page);
    }

    send(404, { message: "not stubbed" });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

// Run standalone so Playwright can boot it as a webServer.
if (process.argv[1] && process.argv[1].endsWith("fake-supabase.mjs")) {
  const port = Number.parseInt(process.env.FAKE_SUPABASE_PORT || "54999", 10);
  startFakeSupabase({ port }).then(() => {
    console.log(`fake supabase listening on ${port}`);
  });
}
