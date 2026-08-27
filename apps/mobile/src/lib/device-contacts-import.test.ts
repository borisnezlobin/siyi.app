const mockGetAllDetails = jest.fn();

jest.mock("expo-contacts", () => ({
  ContactField: {
    FULL_NAME: "fullName",
    GIVEN_NAME: "givenName",
    FAMILY_NAME: "familyName",
    PHONES: "phones",
    EMAILS: "emails",
    IMAGE: "image",
    BIRTHDAY: "birthday",
  },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  Contact: {
    getAllDetails: (...args: unknown[]) => mockGetAllDetails(...args),
    getAll: jest.fn(),
    create: jest.fn(),
  },
}));

import { readDeviceContactsForImport } from "@/lib/device-contacts";

beforeEach(() => {
  mockGetAllDetails.mockReset();
});

describe("readDeviceContactsForImport", () => {
  it("falls back to the given and family names when there is no full name", async () => {
    mockGetAllDetails.mockResolvedValue([
      { id: "1", givenName: "Priya", familyName: "Raman" },
    ]);

    const [contact] = await readDeviceContactsForImport();

    expect(contact.name).toBe("Priya Raman");
  });

  it("keeps a birthday's real year when the contact carries one", async () => {
    mockGetAllDetails.mockResolvedValue([
      {
        id: "1",
        fullName: "Maya Chen",
        birthday: { year: 2004, month: 8, day: 28 },
      },
    ]);

    const [contact] = await readDeviceContactsForImport();

    expect(contact.birthday).toBe("2004-08-28");
  });

  it("writes the placeholder year for a birthday saved without one", async () => {
    // birthday-age reads a year at or before 1900 as "no year given", so the
    // day and month survive without inventing an age.
    mockGetAllDetails.mockResolvedValue([
      { id: "1", fullName: "Maya Chen", birthday: { month: 8, day: 28 } },
    ]);

    const [contact] = await readDeviceContactsForImport();

    expect(contact.birthday).toBe("1900-08-28");
  });

  it("leaves the birthday alone when the contact has none", async () => {
    mockGetAllDetails.mockResolvedValue([{ id: "1", fullName: "Maya Chen" }]);

    const [contact] = await readDeviceContactsForImport();

    expect(contact.birthday).toBeNull();
  });

  it("drops contacts with nothing to show in a list", async () => {
    mockGetAllDetails.mockResolvedValue([
      { id: "1", fullName: "   " },
      { id: "2", fullName: "Liam Osei" },
    ]);

    const contacts = await readDeviceContactsForImport();

    expect(contacts.map((contact) => contact.name)).toEqual(["Liam Osei"]);
  });

  it("sorts by name regardless of case", async () => {
    mockGetAllDetails.mockResolvedValue([
      { id: "1", fullName: "sofia alvarez" },
      { id: "2", fullName: "Jordan Kim" },
    ]);

    const contacts = await readDeviceContactsForImport();

    expect(contacts.map((contact) => contact.name)).toEqual([
      "Jordan Kim",
      "sofia alvarez",
    ]);
  });

  it("carries the picture and the first of each contact method", async () => {
    mockGetAllDetails.mockResolvedValue([
      {
        id: "1",
        fullName: "Jordan Kim",
        image: "file:///jordan.jpg",
        phones: [{ number: "(415) 555-0148" }, { number: "(415) 555-0100" }],
        emails: [{ address: "jordan@example.edu" }],
      },
    ]);

    const [contact] = await readDeviceContactsForImport();

    expect(contact.imageUri).toBe("file:///jordan.jpg");
    expect(contact.phoneNumbers[0]).toBe("(415) 555-0148");
    expect(contact.emails).toEqual(["jordan@example.edu"]);
  });
});
