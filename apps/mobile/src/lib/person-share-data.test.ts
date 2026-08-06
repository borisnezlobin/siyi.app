jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("expo-crypto", () => ({
  getRandomBytes: (size: number) => new Uint8Array(size),
}));

import { defaultContactShareSelection } from "@/lib/contact-card";
import {
  createPersonShare,
  listPersonShares,
  revokePersonShare,
} from "@/lib/person-share-data";

type Result = { data: unknown; error: { code?: string } | null };

function fakeClient(result: Result) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];

  const chain = {
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    single: () => Promise.resolve(result),
    then: (resolve: (value: Result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };

  return {
    inserted,
    updated,
    client: {
      from: () => ({
        select: () => chain,
        insert: (row: Record<string, unknown>) => {
          inserted.push(row);
          return { select: () => chain };
        },
        update: (values: Record<string, unknown>) => {
          updated.push(values);
          return chain;
        },
      }),
    } as never,
  };
}

const randomBytes = (size: number) =>
  new Uint8Array(Array.from({ length: size }, (_, index) => index * 7 + 3));

const row = {
  id: "share-1",
  person_id: "person-1",
  token: "a".repeat(32),
  fields: { hometown: true },
  expires_at: "2026-09-05T00:00:00.000Z",
  revoked_at: null,
  last_viewed_at: null,
  view_count: 0,
  created_at: "2026-08-06T00:00:00.000Z",
};

describe("creating a link from the phone", () => {
  it("stores a token, the selection and a thirty day expiry", async () => {
    const { client, inserted } = fakeClient({ data: row, error: null });

    const result = await createPersonShare(
      {
        userId: "owner-1",
        personId: "person-1",
        selection: defaultContactShareSelection,
        expiry: "30d",
      },
      client,
      randomBytes,
    );

    expect(result.share?.id).toBe("share-1");
    expect(inserted[0].token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(inserted[0].expires_at).toEqual(expect.any(String));
    expect(inserted[0].fields).toEqual({
      ...defaultContactShareSelection,
      bio: false,
    });
  });

  it("never carries the on-device bio", async () => {
    const { client, inserted } = fakeClient({ data: row, error: null });

    await createPersonShare(
      {
        userId: "owner-1",
        personId: "person-1",
        selection: { ...defaultContactShareSelection, bio: true },
        expiry: "30d",
      },
      client,
      randomBytes,
    );

    expect((inserted[0].fields as Record<string, boolean>).bio).toBe(false);
  });

  it("falls back quietly when migration 0015 has not been applied", async () => {
    const { client } = fakeClient({ data: null, error: { code: "42P01" } });

    const result = await createPersonShare(
      {
        userId: "owner-1",
        personId: "person-1",
        selection: defaultContactShareSelection,
        expiry: "30d",
      },
      client,
      randomBytes,
    );

    // Unavailable, not an error: the sheet hides links and keeps the vCard.
    expect(result).toEqual({ share: null, unavailable: true });
    expect(result.error).toBeUndefined();
  });

  it("does tell the sharer about a real failure", async () => {
    const { client } = fakeClient({ data: null, error: { code: "23505" } });

    const result = await createPersonShare(
      {
        userId: "owner-1",
        personId: "person-1",
        selection: defaultContactShareSelection,
        expiry: "30d",
      },
      client,
      randomBytes,
    );

    expect(result.error).toBeTruthy();
  });
});

describe("listing links", () => {
  it("reports links as unavailable when the table is missing", async () => {
    const { client } = fakeClient({ data: null, error: { code: "42P01" } });
    expect(await listPersonShares("person-1", client)).toEqual({
      available: false,
      shares: [],
    });
  });

  it("hides links that have already expired", async () => {
    const { client } = fakeClient({
      data: [
        { ...row, id: "old", expires_at: "2020-01-01T00:00:00.000Z" },
        { ...row, id: "live", expires_at: null },
      ],
      error: null,
    });

    const listed = await listPersonShares("person-1", client);
    expect(listed.available).toBe(true);
    expect(listed.shares.map((share) => share.id)).toEqual(["live"]);
  });
});

describe("revoking a link", () => {
  it("stamps revoked_at", async () => {
    const { client, updated } = fakeClient({ data: null, error: null });

    expect(await revokePersonShare("share-1", client)).toBe(true);
    expect(updated[0].revoked_at).toEqual(expect.any(String));
  });

  it("reports a failure rather than pretending", async () => {
    const { client } = fakeClient({ data: null, error: { code: "500" } });
    expect(await revokePersonShare("share-1", client)).toBe(false);
  });
});
