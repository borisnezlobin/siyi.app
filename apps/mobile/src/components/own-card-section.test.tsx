import { fireEvent, render, screen } from "@testing-library/react-native";
import * as mockReact from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OwnCardSection } from "@/components/own-card-section";
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

/**
 * The card belongs on the Settings page itself, not behind a link to another
 * screen — which is where the web has it, and the two are meant to match. This
 * asserts the section renders the code directly, so the day somebody decides
 * a link would be tidier, this is what stops them.
 */
describe("your card, wherever it is shown", () => {
  it("shows the code itself rather than a way to go and find it", async () => {
    mockGetOwnProfile.mockResolvedValue({
      handle: "alex.vale",
      tag: "4f21",
      isPublic: true,
      publicFields: {},
    } as OwnProfile);

    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <OwnCardSection />
      </SafeAreaProvider>,
    );

    expect(await screen.findByTestId("profile-qr-code")).toBeTruthy();
    expect(screen.getByLabelText("Enable shareable link")).toBeTruthy();
  });

  it("hides everything under the switch while the card is off", async () => {
    mockGetOwnProfile.mockResolvedValue({
      handle: "alex.vale",
      tag: "4f21",
      isPublic: false,
      publicFields: {},
    } as OwnProfile);

    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <OwnCardSection />
      </SafeAreaProvider>,
    );

    await screen.findByLabelText("Enable shareable link");
    // Absent, not greyed: a disabled control invites you to try it.
    expect(screen.queryByTestId("profile-qr-code")).toBeNull();
  });
});
