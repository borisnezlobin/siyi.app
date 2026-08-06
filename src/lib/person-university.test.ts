import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireAuthenticatedUser = vi.fn();
const requireAuthenticatedRequest = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedUser: () => requireAuthenticatedUser(),
}));
vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedRequest: (request: NextRequest) =>
    requireAuthenticatedRequest(request),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));
vi.mock("@/app/api/people/contact-methods", () => ({
  saveContactMethods: async () => ({ error: null }),
}));

const { GET: exportData } = await import("@/app/api/export/route");
const { POST: importData } = await import("@/app/api/import/route");
const { POST: createPerson } = await import("@/app/api/people/route");
const { PATCH: updatePerson } = await import("@/app/api/people/[id]/route");

const userId = "44444444-4444-4444-8444-444444444444";
const personId = "20000000-0000-4000-8000-000000000001";

const storedPerson = {
  id: personId,
  user_id: userId,
  full_name: "Maya Chen",
  preferred_name: "Maya",
  profile_photo_url: null,
  instagram_username: "mayamakes",
  phone_number: null,
  email: null,
  birthday: "2005-03-18",
  hometown: "Portland",
  dorm_or_residence: "Birch Hall",
  university: "Westmont University",
  major: "Ceramics",
  graduation_year: 2027,
  relationship_strength: 3,
  relationship_label: null,
  reminders_enabled: true,
  reminder_interval_days: null,
  status: "active",
  first_met_at: "2026-01-01T00:00:00.000Z",
  first_met_location: "Design club",
  general_notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const emptyTable = { data: [], error: null };

function stubExportTables() {
  return {
    from: (table: string) => ({
      select: () => {
        const result =
          table === "people" ? { data: [storedPerson], error: null } : emptyTable;
        return Object.assign(Promise.resolve(result), {
          eq: () =>
            Object.assign(Promise.resolve(result), {
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          maybeSingle: async () => ({ data: null, error: null }),
        });
      },
    }),
  };
}

function requestFor(url: string) {
  return { url } as unknown as NextRequest;
}

function requestWith(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedUser.mockResolvedValue({ id: userId });
});

describe("university survives a round trip through export and import", () => {
  it("writes the university out and reads it back in", async () => {
    const supabase = stubExportTables();
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: userId },
      supabase,
    });

    const exported = await exportData(
      requestFor("https://siyi.test/api/export?format=json"),
    );
    const payload = await exported.json();

    expect(payload.people[0].university).toBe("Westmont University");

    const upserted: Record<string, unknown>[] = [];
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: userId },
      supabase: {
        from: () => ({
          upsert: async (row: Record<string, unknown>) => {
            upserted.push(row);
            return { data: null, error: null };
          },
        }),
      },
    });

    const imported = await importData(requestWith(payload));
    expect(imported.status).toBe(200);
    expect(upserted[0].university).toBe("Westmont University");
  });

  it("names the university in the people CSV", async () => {
    requireAuthenticatedRequest.mockResolvedValue({
      user: { id: userId },
      supabase: stubExportTables(),
    });

    const response = await exportData(
      requestFor("https://siyi.test/api/export?format=people-csv"),
    );
    const [headerRow, personRow] = (await response.text()).split("\n");

    expect(headerRow.split(",").indexOf('"University"')).toBe(
      personRow.split(",").indexOf('"Westmont University"'),
    );
  });
});

describe("saving a university before migration 0016 has run", () => {
  it("retries the update without the column instead of failing", async () => {
    const attempts: Record<string, unknown>[] = [];
    const missingColumn = {
      code: "42703",
      message: "column people.university does not exist",
    };

    createClient.mockResolvedValue({
      from: () => ({
        update: (row: Record<string, unknown>) => {
          attempts.push(row);
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: async () =>
                    attempts.length === 1
                      ? { data: null, error: missingColumn }
                      : { data: { ...storedPerson, hometown: "Seattle" }, error: null },
                }),
              }),
            }),
          };
        },
      }),
    });

    const response = await updatePerson(
      requestWith({ hometown: "Seattle", university: "Westmont University" }),
      { params: Promise.resolve({ id: personId }) },
    );

    expect(response.status).toBe(200);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toHaveProperty("university", "Westmont University");
    expect(attempts[1]).not.toHaveProperty("university");
    expect(attempts[1]).toHaveProperty("hometown", "Seattle");
  });

  it("hands the university to the create function, which ignores it until then", async () => {
    const calls: Record<string, unknown>[] = [];
    createClient.mockResolvedValue({
      rpc: async (_name: string, args: { person_data: Record<string, unknown> }) => {
        calls.push(args.person_data);
        return { data: { id: personId }, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: storedPerson, error: null }),
          }),
        }),
      }),
    });

    await createPerson(
      requestWith({
        fullName: "Maya Chen",
        relationshipStrength: 2,
        reminderIntervalDays: null,
        graduationYear: null,
        university: "Westmont University",
      }),
    );

    expect(calls[0].university).toBe("Westmont University");
  });
});
