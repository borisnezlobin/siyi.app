import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Where a failure that happened in somebody's browser gets written down.
 *
 * A render that throws on a phone is invisible: `console.error` goes to a
 * console nobody can open, and a server that never saw the request logs
 * nothing. Production held exactly one server-side error across a week while
 * the reader was meeting the error screen most mornings — so most of what goes
 * wrong is happening after the page reaches them, and there was no way to find
 * out what.
 *
 * Deliberately not stored in the database and not tied to an account. It goes
 * to the platform log and no further, which is enough to name the fault and
 * cannot grow into a table of people's broken sessions.
 */

/** Long enough for a stack worth reading, short enough not to be a channel. */
const maxFieldLength = 2000;

function trimmed(value: unknown) {
  return typeof value === "string" ? value.slice(0, maxFieldLength) : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const report = body as Record<string, unknown>;
  const name = trimmed(report.name);
  const message = trimmed(report.message);
  if (!message) return NextResponse.json({ ok: false }, { status: 400 });

  console.error("[siyi] client render failed", {
    name,
    message,
    digest: trimmed(report.digest),
    stack: trimmed(report.stack),
    at: trimmed(report.at),
    // Which build the browser was running. A mismatch with the build that
    // answers this request is the whole answer on its own.
    build: trimmed(report.build),
    standalone: report.standalone === true,
    userAgent: trimmed(request.headers.get("user-agent")),
  });

  return NextResponse.json({ ok: true });
}
