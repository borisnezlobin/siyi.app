import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireAuthenticatedUser = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedUser: () => requireAuthenticatedUser(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

const { POST: logInteraction } = await import("@/app/api/interactions/route");
const { POST: addUpdate } = await import("@/app/api/updates/route");

const amelia = "20000000-0000-4000-8000-000000000001";
const luis = "20000000-0000-4000-8000-000000000002";
const rosa = "20000000-0000-4000-8000-000000000003";
const lastNight = "2026-05-01T20:00:00.000Z";

function requestWith(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function stubInteractionsTable() {
  const inserted: Record<string, unknown>[][] = [];
  const supabase = {
    from: () => ({
      insert(rows: Record<string, unknown>[]) {
        inserted.push(rows);
        return {
          select: async () => ({ data: rows, error: null }),
        };
      },
    }),
  };
  return { supabase, inserted };
}

function stubRpc() {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: { id: "update-1" }, error: null };
    },
  };
  return { supabase, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
});

describe("logging who you saw", () => {
  it("writes one interaction for every person selected", async () => {
    const { supabase, inserted } = stubInteractionsTable();
    createClient.mockResolvedValue(supabase);

    const response = await logInteraction(
      requestWith({
        personIds: [amelia, luis, rosa],
        type: "coffee",
        occurredAt: lastNight,
        note: "Studio night.",
      }),
    );

    expect(response.status).toBe(201);
    expect(inserted[0]).toHaveLength(3);
    expect(inserted[0].map((row) => row.person_id)).toEqual([
      amelia,
      luis,
      rosa,
    ]);
    // Every row carries the same moment, so all three reminders move together.
    for (const row of inserted[0]) {
      expect(row.occurred_at).toBe(lastNight);
      expect(row.user_id).toBe("user-1");
      expect(row.type).toBe("coffee");
    }
  });

  it("saves without a note, because who you saw is the point", async () => {
    const { supabase, inserted } = stubInteractionsTable();
    createClient.mockResolvedValue(supabase);

    const response = await logInteraction(
      requestWith({ personIds: [amelia], type: "met", occurredAt: lastNight }),
    );

    expect(response.status).toBe(201);
    expect(inserted[0][0].note).toBeNull();
  });

  it("never logs the same person twice from one selection", async () => {
    const { supabase, inserted } = stubInteractionsTable();
    createClient.mockResolvedValue(supabase);

    await logInteraction(
      requestWith({
        personIds: [amelia, amelia, luis],
        type: "met",
        occurredAt: lastNight,
      }),
    );

    expect(inserted[0]).toHaveLength(2);
  });

  it("still accepts the single person older clients send", async () => {
    const { supabase, inserted } = stubInteractionsTable();
    createClient.mockResolvedValue(supabase);

    const response = await logInteraction(
      requestWith({ personId: amelia, type: "texted", occurredAt: lastNight }),
    );

    expect(response.status).toBe(201);
    expect(inserted[0]).toHaveLength(1);
    expect(inserted[0][0].person_id).toBe(amelia);
  });

  it("refuses a selection with nobody in it", async () => {
    createClient.mockResolvedValue(stubInteractionsTable().supabase);

    const response = await logInteraction(
      requestWith({ personIds: [], type: "met", occurredAt: lastNight }),
    );

    expect(response.status).toBe(400);
  });
});

describe("adding an update about someone", () => {
  it("does not count as having contacted them", async () => {
    const { supabase, calls } = stubRpc();
    createClient.mockResolvedValue(supabase);

    const response = await addUpdate(
      requestWith({
        personIds: [amelia],
        text: "Is interested in photography",
        recordedAt: lastNight,
      }),
    );

    expect(response.status).toBe(201);
    expect(calls[0].name).toBe("create_person_update");
    // The flag is the whole decision: false means no interactions row is
    // written, so last-seen and the next reminder stay exactly where they were.
    expect(calls[0].args.is_interaction).toBe(false);
    expect(calls[0].args.interaction_label).toBeNull();
  });

  it("needs words, because a fact you learned is the whole point", async () => {
    createClient.mockResolvedValue(stubRpc().supabase);

    const response = await addUpdate(
      requestWith({ personIds: [amelia], text: "  ", recordedAt: lastNight }),
    );

    expect(response.status).toBe(400);
  });

  it("explains itself when the updates tables have not shipped yet", async () => {
    createClient.mockResolvedValue({
      rpc: async () => ({ data: null, error: { code: "PGRST202", message: "" } }),
    });

    const response = await addUpdate(
      requestWith({
        personIds: [amelia],
        text: "Is interested in photography",
        recordedAt: lastNight,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Updates are not available on this deployment yet.",
    });
  });
});
