import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthScreen from "@/app/auth";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn() }),
}));

const mockSendMagicLink = jest.fn().mockResolvedValue(undefined);
const mockSignInWithPassword = jest.fn().mockResolvedValue(undefined);

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    loading: false,
    session: null,
    profile: null,
    configurationError: null,
    sendMagicLink: mockSendMagicLink,
    signInWithPassword: mockSignInWithPassword,
    signUpWithPassword: jest.fn(),
    sendPasswordReset: jest.fn(),
  }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderAuth() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthScreen />
    </SafeAreaProvider>,
  );
}

/** Every string the screen rendered, in the order it appears on screen. */
function renderedText(): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object" && "children" in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(screen.toJSON());
  return found;
}

describe("the sign-in screen", () => {
  beforeEach(() => {
    mockSendMagicLink.mockClear();
    mockSignInWithPassword.mockClear();
  });

  it("greets you with the tagline and nothing above it", async () => {
    await renderAuth();

    expect(renderedText()[0]).toBe("Remember the people who matter.");
  });

  it("puts the fields first, then Apple and Google, then the emailed link", async () => {
    await renderAuth();
    const text = renderedText();

    expect(text.indexOf("Email")).toBeLessThan(
      text.indexOf("Continue with Apple"),
    );
    expect(text.indexOf("Password")).toBeLessThan(
      text.indexOf("Continue with Apple"),
    );
    expect(text.indexOf("Continue with Apple")).toBeLessThan(
      text.indexOf("Continue with Google"),
    );
    expect(text.indexOf("Continue with Google")).toBeLessThan(
      text.indexOf("Email me a sign-in link"),
    );
  });

  it("keeps Apple and Google visibly out of service", async () => {
    await renderAuth();

    expect(
      screen.getByText("Apple and Google sign-in are coming soon."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Continue with Apple" }).props
        .accessibilityState.disabled,
    ).toBe(true);
  });

  it("pins the way in, so the keyboard never sits on top of it", async () => {
    await renderAuth();

    const footer = screen.getByTestId("sticky-footer");
    expect(within(footer).getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(
      within(screen.getByTestId("form-scroll")).queryByRole("button", {
        name: "Sign in",
      }),
    ).toBeNull();
  });

  it("says what is missing next to the field that is missing it", async () => {
    await renderAuth();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Add your email address.")).toBeTruthy();
    expect(screen.getByText("Add your password.")).toBeTruthy();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("names the password rule rather than failing silently", async () => {
    await renderAuth();
    await fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "short");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
  });

  it("drops the password field once you choose the emailed link", async () => {
    await renderAuth();
    await fireEvent.press(
      screen.getByRole("button", { name: "Email me a sign-in link" }),
    );

    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Use my password instead" }),
    ).toBeTruthy();
  });

  it("sends the link without ever asking for a password", async () => {
    await renderAuth();
    await fireEvent.press(
      screen.getByRole("button", { name: "Email me a sign-in link" }),
    );
    await fireEvent.changeText(screen.getByLabelText("Email"), "a@b.com");
    await fireEvent.press(
      screen.getByRole("button", { name: "Email me a sign-in link" }),
    );

    expect(mockSendMagicLink).toHaveBeenCalledWith("a@b.com");
  });
});
