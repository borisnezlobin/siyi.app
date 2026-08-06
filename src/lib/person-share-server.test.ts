import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defaultContactShareSelection } from "@/lib/contact-card";
import { createShareToken } from "@/lib/person-share";
import {
  resolveSharedPerson,
  type ShareLookupClient,
} from "@/lib/person-share-server";

const token = createShareToken((size) => new Uint8Array(randomBytes(size)));

const secretPhone = "+1 415 555 0134";

type TableResult = { data: unknown; error: { code?: string } | null };

function fakeClient(tables: Record<string, TableResult>) {
  const updates: Record<string, unknown>[] = [];

  const client = {
    from(table: string) {
      const result: TableResult = tables[table] ?? {
        data: null,
        error: { code: "42P01" },
      };

      const chain = {
        eq: () => chain,
        order: () => chain,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: TableResult) => unknown) =>
          Promise.resolve(result).then(resolve),
      };

      return {
        select: () => chain,
        update: (values: Record<string, unknown>) => {
          updates.push(values);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  } as unknown as ShareLookupClient;

  return { client, updates };
}

function shareRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "share-1",
    person_id: "person-1",
    token,
    fields: { ...defaultContactShareSelection },
    expires_at: "2099-01-01T00:00:00.000Z",
    revoked_at: null,
    last_viewed_at: null,
    view_count: 0,
    created_at: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

function personRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "person-1",
    user_id: "owner-1",
    full_name: "Maya Chen",
    preferred_name: "May",
    phone_number: secretPhone,
    email: "maya@example.edu",
    instagram_username: "mayamakes",
    birthday: "2004-05-12",
    hometown: "Portland",
    university: "Berkeley",
    major: "Ceramics",
    general_notes: "Going through a rough breakup; do not bring it up.",
    status: "active",
    ...overrides,
  };
}

function tables(
  share: Record<string, unknown> | null,
  person: Record<string, unknown> | null,
  contactMethods: unknown[] = [],
) {
  return {
    person_shares: { data: share, error: null },
    people: { data: person, error: null },
    person_contact_methods: { data: contactMethods, error: null },
  };
}

describe("resolving a share link", () => {
  it("returns the person for a live link", async () => {
    const { client } = fakeClient(tables(shareRow(), personRow()));
    const resolved = await resolveSharedPerson(token, client);

    expect(resolved?.person.fullName).toBe("Maya Chen");
    expect(resolved?.person.hometown).toBe("Portland");
    expect(resolved?.shareId).toBe("share-1");
  });

  it("exposes only the fields the sharer ticked", async () => {
    const { client } = fakeClient(
      tables(shareRow(), personRow(), [
        {
          id: "cm-1",
          kind: "phone",
          value: secretPhone,
          position: 0,
          is_primary: true,
        },
      ]),
    );
    const resolved = await resolveSharedPerson(token, client);
    const body = JSON.stringify(resolved);

    // Phone, email and notes are off by default and must not reach the page.
    expect(body).not.toContain(secretPhone);
    expect(body).not.toContain("555");
    expect(body).not.toContain("maya@example.edu");
    expect(body).not.toContain("rough breakup");
    // Nothing about the sharer, either.
    expect(body).not.toContain("owner-1");

    expect(body).toContain("Portland");
    expect(body).toContain("mayamakes");
  });

  it("carries a phone number through once it is ticked", async () => {
    const { client } = fakeClient(
      tables(
        shareRow({
          fields: { ...defaultContactShareSelection, phoneNumber: true },
        }),
        personRow(),
      ),
    );

    expect(JSON.stringify(await resolveSharedPerson(token, client))).toContain(
      secretPhone,
    );
  });

  it("never carries a bio, which only ever exists on the sharer's device", async () => {
    const { client } = fakeClient(
      tables(
        shareRow({ fields: { ...defaultContactShareSelection, bio: true } }),
        personRow(),
      ),
    );

    expect((await resolveSharedPerson(token, client))?.selection.bio).toBe(false);
  });

  it("refuses an expired link", async () => {
    const { client } = fakeClient(
      tables(shareRow({ expires_at: "2020-01-01T00:00:00.000Z" }), personRow()),
    );
    expect(await resolveSharedPerson(token, client)).toBeNull();
  });

  it("refuses a revoked link straight away", async () => {
    const { client } = fakeClient(
      tables(
        shareRow({ revoked_at: "2026-08-06T00:00:00.000Z" }),
        personRow(),
      ),
    );
    expect(await resolveSharedPerson(token, client)).toBeNull();
  });

  it("refuses a token that was never issued", async () => {
    const { client } = fakeClient(tables(null, null));
    expect(await resolveSharedPerson(token, client)).toBeNull();
  });

  it("refuses a token of the wrong shape without touching the database", async () => {
    const { client } = fakeClient(tables(shareRow(), personRow()));

    expect(await resolveSharedPerson("nope", client)).toBeNull();
    expect(await resolveSharedPerson("", client)).toBeNull();
    expect(await resolveSharedPerson(null, client)).toBeNull();
    expect(await resolveSharedPerson(`${token}'--`, client)).toBeNull();
  });

  it("refuses once the person has been archived", async () => {
    const { client } = fakeClient(
      tables(shareRow(), personRow({ status: "archived" })),
    );
    expect(await resolveSharedPerson(token, client)).toBeNull();
  });

  it("refuses once the person has been deleted", async () => {
    // The cascade removes the share row too, but a page mid-delete must not
    // render a half-resolved person either.
    const { client } = fakeClient(tables(shareRow(), null));
    expect(await resolveSharedPerson(token, client)).toBeNull();
  });

  it("refuses quietly when migration 0015 has not been applied", async () => {
    const { client } = fakeClient({
      person_shares: { data: null, error: { code: "42P01" } },
      people: { data: personRow(), error: null },
      person_contact_methods: { data: [], error: null },
    });
    expect(await resolveSharedPerson(token, client)).toBeNull();
  });

  it("still resolves when migration 0013 has not been applied", async () => {
    const { client } = fakeClient({
      person_shares: { data: shareRow(), error: null },
      people: { data: personRow(), error: null },
      person_contact_methods: { data: null, error: { code: "42P01" } },
    });

    const resolved = await resolveSharedPerson(token, client);
    expect(resolved?.person.instagramUsername).toBe("mayamakes");
  });
});
