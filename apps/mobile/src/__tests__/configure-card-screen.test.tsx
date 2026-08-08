import { fireEvent, render, screen } from "@testing-library/react-native";
import * as mockReact from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ConfigureCardScreen from "@/app/(app)/configure-card";
import type { OwnProfile } from "@/lib/profile-data";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useFocusEffect: (callback: () => void) =>
    mockReact.useEffect(() => callback(), [callback]),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

jest.mock("@expo/ui/community/datetime-picker", () => ({
  DateTimePicker: () => null,
}));

const mockGetOwnProfile = jest.fn();
const mockSaveOwnProfile = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/profile-data", () => ({
  getOwnProfile: (...args: unknown[]) => mockGetOwnProfile(...args),
  saveOwnProfile: (...args: unknown[]) => mockSaveOwnProfile(...args),
}));

const mockGetAccountSettings = jest.fn();
const mockSaveOwnCard = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/data", () => ({
  getAccountSettings: (...args: unknown[]) => mockGetAccountSettings(...args),
  saveOwnCard: (...args: unknown[]) => mockSaveOwnCard(...args),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    profile: { email: "alex@berkeley.edu" },
  }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const profile: OwnProfile = {
  handle: "alex.vale",
  tag: "4f21",
  isPublic: true,
  // Hometown is filled in but held back; the major is filled in and shared.
  publicFields: { major: true },
};

async function renderScreen(ownCard: Record<string, string>) {
  mockGetOwnProfile.mockResolvedValue(profile);
  mockGetAccountSettings.mockResolvedValue({
    ownCard,
    ownCardEnabled: true,
    defaultUniversity: "",
  });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ConfigureCardScreen />
    </SafeAreaProvider>,
  );
}

const filledCard = { major: "Computer Science", hometown: "Seoul" };

describe("the What gets shared screen", () => {
  beforeEach(() => {
    mockSaveOwnProfile.mockClear();
    mockSaveOwnCard.mockClear();
  });

  it("shows a filled-in, shared field as selected", async () => {
    await renderScreen(filledCard);

    const chip = await screen.findByLabelText("Major, shared");
    expect(chip.props.accessibilityState.checked).toBe(true);
    expect(chip.props.accessibilityState.disabled).toBe(false);
  });

  it("shows a filled-in field that is held back as crossed out, and still usable", async () => {
    await renderScreen(filledCard);

    const chip = await screen.findByLabelText("Hometown, not shared");
    expect(chip.props.accessibilityState.checked).toBe(false);
    expect(chip.props.accessibilityState.disabled).toBe(false);
  });

  it("cannot select a field that has nothing in it", async () => {
    await renderScreen(filledCard);

    const chip = await screen.findByLabelText("Discord, nothing to share yet");
    expect(chip.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(chip);

    expect(mockSaveOwnProfile).not.toHaveBeenCalled();
  });

  it("names the state out loud, so the three are told apart without seeing them", async () => {
    await renderScreen(filledCard);

    expect(await screen.findByLabelText("Major, shared")).toBeTruthy();
    expect(screen.getByLabelText("Hometown, not shared")).toBeTruthy();
    expect(screen.getByLabelText("Full name, nothing to share yet")).toBeTruthy();
  });

  it("shares a field that was being held back", async () => {
    await renderScreen(filledCard);

    await fireEvent.press(await screen.findByLabelText("Hometown, not shared"));

    expect(mockSaveOwnProfile).toHaveBeenCalledWith("user-1", {
      publicFields: { major: true, hometown: true },
    });
  });

  it("lets a blank field become shareable as soon as it has something in it", async () => {
    await renderScreen(filledCard);

    expect(
      (await screen.findByLabelText("Goes by, nothing to share yet")).props
        .accessibilityState.disabled,
    ).toBe(true);

    await fireEvent.changeText(screen.getByLabelText("Goes by"), "Alex");

    const chip = await screen.findByLabelText("Goes by, not shared");
    expect(chip.props.accessibilityState.disabled).toBe(false);
  });

  it("offers the school behind the account's own address, without filling it in", async () => {
    await renderScreen(filledCard);

    expect(
      await screen.findByText(
        "From your berkeley.edu address: University of California, Berkeley",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("University").props.value).toBe("");
  });

  it("never offers a school over one already recorded", async () => {
    await renderScreen({ ...filledCard, university: "Carnegie Mellon University" });

    await screen.findByLabelText("Major, shared");
    expect(screen.queryByText(/From your berkeley.edu address/)).toBeNull();
  });

  it("asks for a school by autocomplete, offering matches as you type", async () => {
    await renderScreen(filledCard);

    const field = await screen.findByLabelText("University");
    await fireEvent(field, "focus");
    await fireEvent.changeText(field, "berkeley");

    expect(
      await screen.findByText("University of California, Berkeley"),
    ).toBeTruthy();
  });

  it("takes a graduation year on a number pad, and a birthday in any spelling", async () => {
    await renderScreen(filledCard);

    expect(
      (await screen.findByLabelText("Graduation year")).props.keyboardType,
    ).toBe("number-pad");

    const birthday = screen.getByLabelText("Birthday");
    await fireEvent.changeText(birthday, "March 18 2004");

    expect(await screen.findByText("March 18, 2004")).toBeTruthy();
  });
});
