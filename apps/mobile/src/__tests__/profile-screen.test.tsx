import { fireEvent, render, screen } from "@testing-library/react-native";
import * as mockReact from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ProfileScreen from "@/app/(app)/profile";
import type { OwnProfile } from "@/lib/profile-data";

const mockBack = jest.fn();

jest.mock("expo-router", () => {
  return {
    useRouter: () => ({ back: mockBack }),
    useFocusEffect: (callback: () => void) =>
      mockReact.useEffect(() => callback(), [callback]),
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

jest.mock("react-native-qrcode-svg", () => "QRCodeView");

jest.mock("@/components/connect-ripple", () => ({ ConnectRipple: () => null }));

const mockGetOwnProfile = jest.fn();
const mockSaveOwnProfile = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/profile-data", () => ({
  getOwnProfile: (...args: unknown[]) => mockGetOwnProfile(...args),
  saveOwnProfile: (...args: unknown[]) => mockSaveOwnProfile(...args),
}));

const mockSaveOwnCard = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/data", () => ({
  getAccountSettings: jest.fn().mockResolvedValue({
    ownCard: { fullName: "Boris Nezlobin", major: "Computer Science" },
    ownCardEnabled: true,
    defaultUniversity: "",
  }),
  saveOwnCard: (...args: unknown[]) => mockSaveOwnCard(...args),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** What a profile created after migration 0020 arrives with. */
const newProfile: OwnProfile = {
  handle: "boris.nezlobin",
  tag: "4f21",
  isPublic: true,
  publicFields: { fullName: true, major: true },
};

/** Somebody who was here first and turned their page off. */
const existingProfileTurnedOff: OwnProfile = {
  handle: "boris.nezlobin",
  tag: "4f21",
  isPublic: false,
  publicFields: {},
};

async function renderProfile(profile: OwnProfile) {
  mockGetOwnProfile.mockResolvedValue(profile);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ProfileScreen />
    </SafeAreaProvider>,
  );
}

describe("the Your card screen", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockSaveOwnProfile.mockClear();
    mockSaveOwnCard.mockClear();
  });

  it("can be left the way every other pushed screen can", async () => {
    await renderProfile(newProfile);

    await fireEvent.press(screen.getByLabelText("Go back"));

    expect(mockBack).toHaveBeenCalled();
  });

  it("leads with the switch, then the link and the code", async () => {
    await renderProfile(newProfile);

    expect(screen.getByLabelText("Enable shareable link")).toBeTruthy();
    expect(
      screen.getByText("People can find you at https://www.siyi.app/@boris.nezlobin-4f21"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show code" })).toBeTruthy();
  });

  it("starts a new profile shared, with the full name and the major ticked", async () => {
    await renderProfile(newProfile);

    expect(screen.getByLabelText("Enable shareable link").props.value).toBe(true);
    expect(
      screen.getByRole("checkbox", { name: "Full name" }).props.accessibilityState
        .checked,
    ).toBe(true);
    expect(
      screen.getByRole("checkbox", { name: "Major" }).props.accessibilityState.checked,
    ).toBe(true);
    expect(
      screen.getByRole("checkbox", { name: "Hometown" }).props.accessibilityState
        .checked,
    ).toBe(false);
  });

  it("never turns an existing profile back on by itself", async () => {
    await renderProfile(existingProfileTurnedOff);

    expect(screen.getByLabelText("Enable shareable link").props.value).toBe(false);
    expect(mockSaveOwnProfile).not.toHaveBeenCalled();
  });

  it("disables everything below the switch rather than only greying it", async () => {
    await renderProfile(existingProfileTurnedOff);

    const handleField = screen.getByLabelText("Your handle");
    expect(handleField.props.editable).toBe(false);
    expect(handleField.props.accessibilityState.disabled).toBe(true);

    const chip = screen.getByRole("checkbox", { name: "Major" });
    expect(chip.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(chip);
    expect(mockSaveOwnProfile).not.toHaveBeenCalled();

    const copyLink = screen.getByRole("button", { name: "Copy link" });
    expect(copyLink.props.accessibilityState.disabled).toBe(true);

    const saveDetails = screen.getByRole("button", { name: "Save my details" });
    expect(saveDetails.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(saveDetails);
    expect(mockSaveOwnCard).not.toHaveBeenCalled();
  });

  it("keeps everything usable while the link is on", async () => {
    await renderProfile(newProfile);

    expect(screen.getByLabelText("Your handle").props.editable).toBe(true);

    await fireEvent.press(screen.getByRole("checkbox", { name: "Hometown" }));

    expect(mockSaveOwnProfile).toHaveBeenCalledWith("user-1", {
      publicFields: { fullName: true, major: true, hometown: true },
    });
  });
});
