import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersonForm } from "@/components/person-form";
import { mockKeyboardEvents } from "@/test-support/keyboard";
import type { Person } from "@/lib/types";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").Image,
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/lib/contact-sync-flow", () => ({
  offerContactSyncAfterSave: jest.fn(),
}));

jest.mock("@/lib/data", () => ({
  createPerson: jest.fn(),
  updatePerson: jest.fn(),
  getUsedNoteHeadings: jest.fn().mockResolvedValue([]),
  createPersonNote: jest.fn(),
  deletePersonNote: jest.fn(),
  movePersonNote: jest.fn(),
  savePersonNote: jest.fn(),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const person = {
  id: "person-1",
  userId: "user-1",
  fullName: "Jordan Lee",
  relationshipStrength: 2,
  remindersEnabled: true,
  status: "active",
  createdAt: "2026-08-01T12:00:00.000Z",
} as unknown as Person;

afterEach(() => {
  jest.restoreAllMocks();
});

describe("editing a person", () => {
  it("groups the fields the way the web form does", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PersonForm person={person} />
      </SafeAreaProvider>,
    );

    for (const heading of [
      "Who they are",
      "How to reach them",
      "About them",
      "How you met",
      "Notes",
      "Reminders",
    ]) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
    expect(screen.queryByText(/basic info/i)).toBeNull();
  });

  it("offers a university beside the other school details", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PersonForm person={{ ...person, university: "Westmont University" }} />
      </SafeAreaProvider>,
    );

    // The school details live in a collapsed group, exactly as on the web.
    await fireEvent.press(screen.getByRole("button", { name: "About them" }));

    expect(screen.getByDisplayValue("Westmont University")).toBeTruthy();
  });

  it("keeps Cancel and Save changes reachable with the keyboard up", async () => {
    const keyboard = mockKeyboardEvents();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PersonForm person={person} />
      </SafeAreaProvider>,
    );
    await keyboard.show();

    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });
});

describe("choosing a profile photo", () => {
  it("saves the photo on its own, without pushing unsaved edits with it", async () => {
    const picker = jest.requireMock("expo-image-picker");
    const data = jest.requireMock("@/lib/data");
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///new.jpg", fileName: "new.jpg", mimeType: "image/jpeg" }],
    });
    data.updatePerson.mockResolvedValue(undefined);

    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PersonForm person={person} />
      </SafeAreaProvider>,
    );

    // A name typed but not saved must not ride along with the photo.
    await fireEvent.changeText(
      screen.getByLabelText("Full name"),
      "Half Typed Name",
    );
    await fireEvent.press(screen.getByLabelText("Add profile photo"));

    expect(data.updatePerson).toHaveBeenCalledTimes(1);
    const [, personId, input, photo] = data.updatePerson.mock.calls[0];
    expect(personId).toBe("person-1");
    expect(input.fullName).toBe("Jordan Lee");
    expect(photo).toMatchObject({ uri: "file:///new.jpg" });
  });

  it("leaves a brand new person's photo to be saved with the rest", async () => {
    const picker = jest.requireMock("expo-image-picker");
    const data = jest.requireMock("@/lib/data");
    // Module mocks keep their call log across tests; restoreAllMocks does not
    // reach them.
    data.updatePerson.mockClear();
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///new.jpg" }],
    });

    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PersonForm />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByLabelText("Add profile photo"));

    expect(data.updatePerson).not.toHaveBeenCalled();
  });
});
