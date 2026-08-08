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
  people: [
    ...Array.from({ length: 5 }, () => ({ user_id: "u-1", created_at: iso(3 * day) })),
    ...Array.from({ length: 120 }, () => ({ user_id: "u-2", created_at: iso(35 * day) })),
  ],
  push_subscriptions: [{ user_id: "u-1", revoked_at: null }],
  native_push_subscriptions: [{ user_id: "u-3", revoked_at: iso(day) }],
  interactions: [{ user_id: "u-1", created_at: iso(2 * day) }],
  announcements: [],
};

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
