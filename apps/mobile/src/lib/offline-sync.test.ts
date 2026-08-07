import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual(
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    ),
);

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
    addEventListener: jest.fn(() => () => undefined),
  },
}));

let mintedIds = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: () => `minted-${(mintedIds += 1)}`,
}));

jest.mock("expo-file-system", () => {
  class FakeDirectory {
    exists = false;
    uri = "file:///fake/";
    create() {}
    list() {
      return [];
    }
  }
  class FakeFile {
    exists = false;
    uri = "file:///fake/file";
    name = "file";
    async copy() {}
    delete() {}
  }
  return {
    Directory: FakeDirectory,
    File: FakeFile,
    Paths: { document: "file:///document/" },
  };
});

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

import { supabase } from "@/lib/supabase";
import {
  deletePersonNote,
  flushOfflineMutations,
  movePersonNote,
  savePersonNote,
  updatePerson,
  type PersonDetails,
} from "@/lib/data";
import { getOfflineQueue, updateOfflineSnapshot } from "@/lib/offline-store";
import type { Person, PersonNote } from "@/lib/types";

type Row = Record<string, unknown>;

const netInfoFetch = NetInfo.fetch as jest.Mock;

/** A stand-in for the two tables these features write to, faithful enough for
 * the handful of calls the replay makes. */
class FakeDatabase {
  tables: Record<string, Row[]> = {};
  missingTables = new Set<string>();
  // Columns a migration would add that the database does not have yet.
  missingColumns = new Set<string>();

  seed(table: string, rows: Row[]) {
    this.tables[table] = rows.map((row) => ({ ...row }));
  }

  rows(table: string) {
    return (this.tables[table] ??= []);
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

type Filter = { column: string; values: unknown[] };

function missingColumnError(column: string) {
  return { code: "42703", message: `column people.${column} does not exist` };
}

class FakeQuery {
  private filters: Filter[] = [];
  private operation: (() => { data: Row[] | null; error: Row | null }) | null =
    null;
  private single = false;

  constructor(
    private database: FakeDatabase,
    private table: string,
  ) {}

  private namedMissingColumn(row: Row) {
    return Object.keys(row).find((column) =>
      this.database.missingColumns.has(column),
    );
  }

  private matching() {
    return this.database
      .rows(this.table)
      .filter((row) =>
        this.filters.every((filter) => filter.values.includes(row[filter.column])),
      );
  }

  select() {
    this.operation = () => ({ data: this.matching(), error: null });
    return this;
  }

  insert(payload: Row | Row[]) {
    this.operation = () => {
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        this.database.rows(this.table).push({ id: `row-${Date.now()}`, ...row });
      }
      return { data: null, error: null };
    };
    return this;
  }

  upsert(payload: Row | Row[]) {
    this.operation = () => {
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        const missing = this.namedMissingColumn(row);
        if (missing) return { data: null, error: missingColumnError(missing) };
      }
      for (const row of rows) {
        const existing = this.database
          .rows(this.table)
          .find((candidate) => candidate.id === row.id);
        if (existing) Object.assign(existing, row);
        else this.database.rows(this.table).push({ ...row });
      }
      return { data: null, error: null };
    };
    return this;
  }

  update(values: Row) {
    this.operation = () => {
      const missing = this.namedMissingColumn(values);
      if (missing) return { data: null, error: missingColumnError(missing) };
      for (const row of this.matching()) Object.assign(row, values);
      return { data: null, error: null };
    };
    return this;
  }

  delete() {
    this.operation = () => {
      const doomed = new Set(this.matching());
      this.database.tables[this.table] = this.database
        .rows(this.table)
        .filter((row) => !doomed.has(row));
      return { data: null, error: null };
    };
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, values: [value] });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, values });
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  then(
    resolve: (result: { data: unknown; error: Row | null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) {
    try {
      if (this.database.missingTables.has(this.table)) {
        return Promise.resolve({
          data: null,
          error: { code: "42P01", message: "relation does not exist" },
        }).then(resolve, reject);
      }
      const result = this.operation?.() ?? { data: null, error: null };
      const data =
        this.single && Array.isArray(result.data)
          ? (result.data[0] ?? null)
          : result.data;
      return Promise.resolve({ ...result, data }).then(resolve, reject);
    } catch (error) {
      return Promise.reject(error).then(resolve, reject);
    }
  }
}

const userId = "user-1";
const personId = "person-1";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: personId,
    slug: null,
    userId,
    fullName: "Jordan Lee",
    preferredName: null,
    profilePhotoUrl: null,
    profilePhotoPath: null,
    instagramUsername: null,
    phoneNumber: "(555) 555-0123",
    email: null,
    birthday: null,
    hometown: null,
    dormOrResidence: null,
    university: null,
    major: null,
    graduationYear: null,
    relationshipStrength: 2,
    relationshipLabel: null,
    remindersEnabled: true,
    reminderIntervalDays: null,
    status: "active",
    firstMetAt: "2026-01-01T12:00:00.000Z",
    firstMetLocation: null,
    generalNotes: null,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    lastInteractionAt: null,
    tags: [],
    ...overrides,
  };
}

function note(overrides: Partial<PersonNote> = {}): PersonNote {
  return {
    id: "note-1",
    personId,
    userId,
    heading: "Interests",
    body: "Climbing.",
    position: 0,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

async function seedSnapshot(details: Partial<PersonDetails> = {}) {
  await updateOfflineSnapshot(userId, (snapshot) => ({
    ...snapshot,
    people: [person()],
    personDetails: {
      [personId]: {
        person: person(),
        interactions: [],
        reminders: [],
        updates: [],
        ...details,
      },
    },
  }));
}

async function goOffline() {
  netInfoFetch.mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
}

async function goOnline() {
  netInfoFetch.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
}

let database: FakeDatabase;

describe("edits made offline reaching the server", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mintedIds = 0;
    database = new FakeDatabase();
    (supabase.from as jest.Mock).mockImplementation((table: string) =>
      database.from(table),
    );
    await goOffline();
  });

  it("queues a note edit and writes it on reconnect", async () => {
    database.seed("person_notes", [
      {
        id: "note-1",
        user_id: userId,
        person_id: personId,
        heading: "Interests",
        body: "Climbing.",
        position: 0,
      },
    ]);
    await seedSnapshot({ notes: { available: true, sections: [note()] } });

    await savePersonNote(userId, note(), {
      heading: "Interests",
      body: "Climbing and pottery.",
    });

    expect(await getOfflineQueue(userId)).toHaveLength(1);
    expect(database.rows("person_notes")[0].body).toBe("Climbing.");

    await goOnline();
    await flushOfflineMutations(userId);

    expect(await getOfflineQueue(userId)).toHaveLength(0);
    expect(database.rows("person_notes")[0].body).toBe("Climbing and pottery.");
  });

  it("keeps both versions when the same section changed on the web meanwhile", async () => {
    database.seed("person_notes", [
      {
        id: "note-1",
        user_id: userId,
        person_id: personId,
        heading: "Interests",
        body: "Climbing.",
        position: 0,
      },
    ]);
    await seedSnapshot({ notes: { available: true, sections: [note()] } });

    await savePersonNote(userId, note(), {
      heading: "Interests",
      body: "Climbing and pottery.",
    });
    database.rows("person_notes")[0].body = "Climbing, and running.";

    await goOnline();
    await flushOfflineMutations(userId);

    const saved = String(database.rows("person_notes")[0].body);
    expect(saved).toContain("Climbing, and running.");
    expect(saved).toContain("Climbing and pottery.");
  });

  it("puts a section back when it was deleted on the web meanwhile", async () => {
    database.seed("person_notes", []);
    await seedSnapshot({ notes: { available: true, sections: [note()] } });

    await savePersonNote(userId, note(), {
      heading: "Interests",
      body: "Climbing and pottery.",
    });
    await goOnline();
    await flushOfflineMutations(userId);

    expect(database.rows("person_notes")).toEqual([
      expect.objectContaining({
        id: "note-1",
        heading: "Interests",
        body: "Climbing and pottery.",
      }),
    ]);
  });

  it("replays a delete and a reorder in the order they were made", async () => {
    const first = note({ id: "note-1", heading: "Interests", position: 0 });
    const second = note({ id: "note-2", heading: "Family", position: 1 });
    database.seed("person_notes", [
      { id: "note-1", user_id: userId, person_id: personId, position: 0 },
      { id: "note-2", user_id: userId, person_id: personId, position: 1 },
      { id: "note-3", user_id: userId, person_id: personId, position: 2 },
    ]);
    await seedSnapshot({
      notes: {
        available: true,
        sections: [first, second, note({ id: "note-3", position: 2 })],
      },
    });

    await movePersonNote(userId, second, "up");
    await deletePersonNote(userId, note({ id: "note-3", position: 2 }));

    expect(await getOfflineQueue(userId)).toHaveLength(2);

    await goOnline();
    await flushOfflineMutations(userId);

    expect(
      database.rows("person_notes").map((row) => [row.id, row.position]),
    ).toEqual([
      ["note-1", 1],
      ["note-2", 0],
    ]);
  });

  it("writes every phone number a person save carried", async () => {
    database.seed("people", [{ id: personId, user_id: userId }]);
    await seedSnapshot();

    await updatePerson(
      userId,
      personId,
      {
        fullName: "Jordan Lee",
        preferredName: null,
        instagramUsername: null,
        phoneNumber: "(555) 555-0123",
        email: null,
        birthday: null,
        hometown: null,
        dormOrResidence: null,
        university: null,
        major: null,
        graduationYear: null,
        relationshipStrength: 2,
        relationshipLabel: null,
        remindersEnabled: true,
        reminderIntervalDays: null,
        firstMetLocation: null,
        generalNotes: null,
      },
      undefined,
      null,
      [
        {
          kind: "phone",
          value: "(555) 555-0123",
          label: "mobile",
          isPrimary: true,
        },
        { kind: "phone", value: "(555) 555-0124", label: "home", isPrimary: false },
      ],
      [],
    );

    expect(await getOfflineQueue(userId)).toHaveLength(1);
    await goOnline();
    await flushOfflineMutations(userId);

    expect(
      database
        .rows("person_contact_methods")
        .map((row) => [row.value, row.position, row.is_primary]),
    ).toEqual([
      ["(555) 555-0123", 0, true],
      ["(555) 555-0124", 1, false],
    ]);
    expect(database.rows("people")[0].phone_number).toBe("(555) 555-0123");
  });

  it("keeps a number added on the web while the phone save waited", async () => {
    database.seed("people", [{ id: personId, user_id: userId }]);
    database.seed("person_contact_methods", [
      {
        id: "web-row",
        user_id: userId,
        person_id: personId,
        kind: "phone",
        value: "(555) 555-0199",
        label: null,
        position: 0,
        is_primary: true,
      },
    ]);
    await seedSnapshot();

    await updatePerson(
      userId,
      personId,
      {
        fullName: "Jordan Lee",
        preferredName: null,
        instagramUsername: null,
        phoneNumber: "(555) 555-0123",
        email: null,
        birthday: null,
        hometown: null,
        dormOrResidence: null,
        university: null,
        major: null,
        graduationYear: null,
        relationshipStrength: 2,
        relationshipLabel: null,
        remindersEnabled: true,
        reminderIntervalDays: null,
        firstMetLocation: null,
        generalNotes: null,
      },
      undefined,
      null,
      [
        {
          kind: "phone",
          value: "(555) 555-0123",
          label: null,
          isPrimary: true,
        },
      ],
      [],
    );
    await goOnline();
    await flushOfflineMutations(userId);

    expect(
      database.rows("person_contact_methods").map((row) => row.value).sort(),
    ).toEqual(["(555) 555-0123", "(555) 555-0199"]);
  });
});

