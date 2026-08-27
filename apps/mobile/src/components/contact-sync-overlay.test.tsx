import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { ContactSyncOverlay } from "@/components/contact-sync-overlay";
import { offerContactSyncAfterSave } from "@/lib/contact-sync-flow";
import { resetContactSyncUi } from "@/lib/contact-sync-ui";
import { isContactSyncEnabled } from "@/lib/device-contacts";
import type { Person } from "@/lib/types";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual(
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    ),
);

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const openSettings = jest
  .spyOn(Linking, "openSettings")
  .mockResolvedValue(undefined);

jest.mock("expo-contacts", () => ({
  ContactField: {
    FULL_NAME: "fullName",
    GIVEN_NAME: "givenName",
    FAMILY_NAME: "familyName",
    PHONES: "phones",
    EMAILS: "emails",
  },
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) =>
    mockRequestPermissions(...args),
  Contact: {
    getAllDetails: jest.fn(async () => []),
    getAll: jest.fn(async () => []),
    create: jest.fn(async () => ({ id: "device-1" })),
  },
}));

jest.mock("@/lib/data", () => ({ getPeople: jest.fn(async () => []) }));

const savedPerson = {
  id: "person-1",
  fullName: "Maya Chen",
  preferredName: "Maya",
  phoneNumber: "4155550134",
  email: null,
  instagramUsername: null,
} as Person;

const explainerTitle = "Save your siyi people to Contacts";

beforeEach(async () => {
  await AsyncStorage.clear();
  resetContactSyncUi();
  mockGetPermissions.mockReset();
  mockRequestPermissions.mockReset();
  openSettings.mockClear();
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
});

/** Lets the fire-and-forget sync flow reach its next await before we assert. */
async function settle() {
  for (let pass = 0; pass < 6; pass++) {
    await act(async () => {});
  }
}

/**
 * Starts the after-save flow and stops once it is waiting on the explainer.
 * The returned callback runs it out; a flow left dangling would land its
 * storage writes in the next test.
 */
async function saveAndWait() {
  await render(<ContactSyncOverlay />);
  const flow = offerContactSyncAfterSave(savedPerson);
  await settle();
  return async (answer?: string) => {
    await act(async () => {
      if (answer) fireEvent.press(screen.getByText(answer));
      await flow;
    });
    await settle();
  };
}

describe("asking for contacts access", () => {
  it("explains what access is for before the system is ever asked", async () => {
    const done = await saveAndWait();

    expect(screen.getByText(explainerTitle)).toBeTruthy();
    expect(
      screen.getByText(/reads your address book to find the person/),
    ).toBeTruthy();
    expect(mockRequestPermissions).not.toHaveBeenCalled();

    await done("Not now");
  });

  it("only asks the system once the explanation has been accepted", async () => {
    mockRequestPermissions.mockResolvedValue({
      granted: true,
      canAskAgain: false,
    });
    const done = await saveAndWait();

    await done("Continue");

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(await isContactSyncEnabled()).toBe(true);
  });

  it("spends nothing when the explanation is declined", async () => {
    const done = await saveAndWait();

    await done("Not now");

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(await isContactSyncEnabled()).toBe(false);
    expect(screen.queryByText(explainerTitle)).toBeNull();
  });

  it("does not ask a second time after being turned down once", async () => {
    const done = await saveAndWait();
    await done("Not now");

    await act(async () => {
      await offerContactSyncAfterSave(savedPerson);
    });
    await settle();

    expect(screen.queryByText(explainerTitle)).toBeNull();
  });
});

describe("when the system says no", () => {
  beforeEach(() => {
    mockRequestPermissions.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
  });

  it("says plainly what is switched off and offers a way back", async () => {
    const done = await saveAndWait();

    await done("Continue");

    expect(screen.getByText("Contacts access is off")).toBeTruthy();
    expect(screen.getByText(/Nothing is written to your contacts/)).toBeTruthy();
    expect(await isContactSyncEnabled()).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByText("Open Settings"));
    });
    await settle();
    expect(openSettings).toHaveBeenCalled();
  });

  it("skips the explainer entirely once the prompt is spent", async () => {
    mockGetPermissions.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    const done = await saveAndWait();
    await done();

    expect(screen.queryByText(explainerTitle)).toBeNull();
    expect(screen.getByText("Contacts access is off")).toBeTruthy();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });
});
