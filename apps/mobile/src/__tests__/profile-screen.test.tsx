import { fireEvent, render, screen } from "@testing-library/react-native";
import * as mockReact from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ProfileScreen from "@/app/(app)/profile";
import type { OwnProfile } from "@/lib/profile-data";

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => {
  return {
    useRouter: () => ({ back: mockBack, push: mockPush }),
    useFocusEffect: (callback: () => void) =>
      mockReact.useEffect(() => callback(), [callback]),
  };
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
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

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** What a profile created after migration 0020 arrives with. */
const sharedProfile: OwnProfile = {
  handle: "alex.vale",
  tag: "4f21",
  isPublic: true,
  publicFields: { fullName: true, major: true },
};

/** Somebody who was here first and turned their page off. */
const profileTurnedOff: OwnProfile = {
  handle: "alex.vale",
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
    mockPush.mockClear();
    mockSaveOwnProfile.mockClear();
  });

  it("can be left the way every other pushed screen can", async () => {
    await renderProfile(sharedProfile);

    await fireEvent.press(screen.getByLabelText("Go back"));

    expect(mockBack).toHaveBeenCalled();
  });

  it("leads with the switch, then the code, the link and the handle", async () => {
    await renderProfile(sharedProfile);

    expect(screen.getByLabelText("Enable shareable link")).toBeTruthy();
    expect(
      screen.getByText("People can find you at https://www.siyi.app/@alex.vale-4f21"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    expect(screen.getByLabelText("Your handle")).toBeTruthy();
  });

  it("shows the code without asking, rather than hiding it behind a button", async () => {
    await renderProfile(sharedProfile);

    expect(screen.getByTestId("profile-qr-code")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show code" })).toBeNull();
  });

  it("sends you to a separate page to choose what is on the card", async () => {
    await renderProfile(sharedProfile);

    await fireEvent.press(
      screen.getByRole("link", { name: "Configure what gets shared" }),
    );

    expect(mockPush).toHaveBeenCalledWith("/configure-card");
  });

  it("never turns an existing profile back on by itself", async () => {
    await renderProfile(profileTurnedOff);

    expect(screen.getByLabelText("Enable shareable link").props.value).toBe(false);
    expect(mockSaveOwnProfile).not.toHaveBeenCalled();
  });

  it("removes everything below the switch when it is off, rather than greying it", async () => {
    await renderProfile(profileTurnedOff);

    // The switch itself is the one thing that stays.
    expect(screen.getByLabelText("Enable shareable link")).toBeTruthy();

    expect(screen.queryByLabelText("Your handle")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Configure what gets shared" }),
    ).toBeNull();
    expect(screen.queryByText(/People can find you at/)).toBeNull();
    expect(screen.queryByTestId("profile-qr-code")).toBeNull();
  });

  it("brings it all back when the switch goes on", async () => {
    await renderProfile(profileTurnedOff);

    mockGetOwnProfile.mockResolvedValue(sharedProfile);
    await fireEvent(
      screen.getByLabelText("Enable shareable link"),
      "valueChange",
      true,
    );

    expect(mockSaveOwnProfile).toHaveBeenCalledWith("user-1", { isPublic: true });
    expect(await screen.findByLabelText("Your handle")).toBeTruthy();
  });
});
