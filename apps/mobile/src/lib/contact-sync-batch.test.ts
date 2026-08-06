import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setContactSyncEnabled,
  syncAllPeopleToDeviceContacts,
  syncPersonToDeviceContacts,
} from "@/lib/device-contacts";
import type { Person } from "@/lib/types";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual(
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    ),
);

type FakeContact = {
  id: string;
  fullName: string;
  givenName: string;
  familyName: string;
  phones: { number: string }[];
  emails: { address: string }[];
  addPhone: (phone: { label: string; number: string }) => Promise<void>;
  addEmail: (email: { label: string; address: string }) => Promise<void>;
};

const mockAddressBook: FakeContact[] = [];
let mockNextContactId = 1;
let mockCreateShouldFail = false;

function mockMakeContact(
  fullName: string,
  phones: string[] = [],
  emails: string[] = [],
): FakeContact {
  const [givenName, ...rest] = fullName.split(" ");
  const contact: FakeContact = {
    id: `device-${mockNextContactId++}`,
    fullName,
    givenName,
    familyName: rest.join(" "),
    phones: phones.map((number) => ({ number })),
    emails: emails.map((address) => ({ address })),
    addPhone: async ({ number }) => {
      contact.phones.push({ number });
    },
    addEmail: async ({ address }) => {
      contact.emails.push({ address });
    },
  };
  return contact;
}

jest.mock("expo-contacts", () => ({
  ContactField: {
    FULL_NAME: "fullName",
    GIVEN_NAME: "givenName",
    FAMILY_NAME: "familyName",
    PHONES: "phones",
    EMAILS: "emails",
  },
  getPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true,
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true,
  })),
  Contact: {
    getAllDetails: jest.fn(async () => mockAddressBook),
    getAll: jest.fn(async () => mockAddressBook),
    create: jest.fn(async (record: Record<string, unknown>) => {
      if (mockCreateShouldFail) throw new Error("The address book is read only.");
      const created = mockMakeContact(
        [record.givenName, record.familyName].filter(Boolean).join(" "),
        ((record.phones as { number: string }[]) ?? []).map(
          (phone) => phone.number,
        ),
        ((record.emails as { address: string }[]) ?? []).map(
          (email) => email.address,
        ),
      );
      mockAddressBook.push(created);
      return created;
    }),
  },
}));

function person(id: string, fullName: string, over: Partial<Person> = {}) {
  return {
    id,
    fullName,
    preferredName: null,
    phoneNumber: null,
    email: null,
    instagramUsername: null,
    ...over,
  } as Person;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockAddressBook.length = 0;
  mockNextContactId = 1;
  mockCreateShouldFail = false;
  await setContactSyncEnabled(true);
});

describe("syncing everyone", () => {
  it("accounts for every person exactly once", async () => {
    mockAddressBook.push(mockMakeContact("Existing Friend", ["2125550100"]));
    mockAddressBook.push(mockMakeContact("Complete Friend", ["2125550101"]));

    const summary = await syncAllPeopleToDeviceContacts([
      person("a", "Brand New", { phoneNumber: "4155550101" }),
      person("b", "Second New", { phoneNumber: "4155550102" }),
      person("c", "Existing Friend", {
        phoneNumber: "2125550100",
        email: "friend@example.edu",
      }),
      person("d", "Complete Friend", { phoneNumber: "2125550101" }),
    ]);

    expect(summary.total).toBe(4);
    expect(summary.created).toBe(2);
    expect(summary.updated).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.created + summary.updated + summary.skipped).toBe(
      summary.total,
    );
    expect(
      summary.alreadyComplete + summary.keptDeviceValue + summary.failed,
    ).toBe(summary.skipped);
    expect(summary.interrupted).toBe(false);
  });

  it("counts the values it refused to overwrite instead of hiding them", async () => {
    mockAddressBook.push(mockMakeContact("Maya Chen", ["2125559999"], ["old@a.edu"]));

    const summary = await syncAllPeopleToDeviceContacts([
      person("a", "Maya Chen", {
        phoneNumber: "4155550134",
        email: "new@a.edu",
      }),
    ]);

    expect(summary.conflicts).toBe(2);
    expect(summary.keptDeviceValue).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(mockAddressBook[0].phones.map(({ number }) => number)).toEqual([
      "2125559999",
    ]);
    expect(mockAddressBook[0].emails.map(({ address }) => address)).toEqual([
      "old@a.edu",
    ]);
  });

  it("reports a person it could not write without abandoning the rest", async () => {
    mockCreateShouldFail = true;

    const summary = await syncAllPeopleToDeviceContacts([
      person("a", "Brand New", { phoneNumber: "4155550101" }),
      person("b", "Also New", { phoneNumber: "4155550102" }),
    ]);

    expect(summary.failed).toBe(2);
    expect(summary.skipped).toBe(2);
    expect(summary.created + summary.updated + summary.skipped).toBe(2);
    expect(summary.failures).toHaveLength(2);
  });

  it("reports progress that ends on the last person", async () => {
    const seen: number[] = [];
    await syncAllPeopleToDeviceContacts(
      [
        person("a", "One", { phoneNumber: "4155550101" }),
        person("b", "Two", { phoneNumber: "4155550102" }),
        person("c", "Three", { phoneNumber: "4155550103" }),
      ],
      { onProgress: ({ completed }) => seen.push(completed) },
    );

    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(3);
  });

  it("picks up where a killed pass stopped rather than starting over", async () => {
    const people = [
      person("a", "One", { phoneNumber: "4155550101" }),
      person("b", "Two", { phoneNumber: "4155550102" }),
      person("c", "Three", { phoneNumber: "4155550103" }),
    ];

    let handled = 0;
    const stopped = await syncAllPeopleToDeviceContacts(people, {
      shouldContinue: () => handled++ < 2,
    });
    expect(stopped.interrupted).toBe(true);
    expect(mockAddressBook).toHaveLength(2);

    const resumed = await syncAllPeopleToDeviceContacts(people);
    expect(resumed.interrupted).toBe(false);
    expect(resumed.created).toBe(3);
    expect(mockAddressBook).toHaveLength(3);
  });

  it("writes nothing at all while sync is switched off", async () => {
    await setContactSyncEnabled(false);

    const summary = await syncAllPeopleToDeviceContacts([
      person("a", "One", { phoneNumber: "4155550101" }),
    ]);

    expect(summary.created).toBe(0);
    expect(summary.interrupted).toBe(true);
    expect(mockAddressBook).toHaveLength(0);
  });
});

describe("syncing one person", () => {
  it("adds only what the device is missing", async () => {
    mockAddressBook.push(mockMakeContact("Maya Chen", ["4155550134"]));

    const result = await syncPersonToDeviceContacts(
      person("a", "Maya Chen", {
        phoneNumber: "4155550134",
        email: "maya@example.edu",
      }),
    );

    expect(result.status).toBe("updated");
    expect(mockAddressBook[0].phones).toHaveLength(1);
    expect(mockAddressBook[0].emails.map(({ address }) => address)).toEqual([
      "maya@example.edu",
    ]);
  });

  it("leaves a differing device value exactly as it was", async () => {
    mockAddressBook.push(mockMakeContact("Maya Chen", ["2125559999"]));

    const result = await syncPersonToDeviceContacts(
      person("a", "Maya Chen", { phoneNumber: "4155550134" }),
    );

    expect(result).toEqual({
      status: "unchanged",
      skipped: [
        {
          field: "phoneNumber",
          existing: "2125559999",
          incoming: "4155550134",
        },
      ],
    });
    expect(mockAddressBook[0].phones.map(({ number }) => number)).toEqual([
      "2125559999",
    ]);
  });
});
