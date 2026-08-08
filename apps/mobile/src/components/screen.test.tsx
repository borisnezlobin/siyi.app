import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Screen } from "@/components/screen";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Every page in the app scrolls inside this one component, so its scroll view
 * is where a tap-through bug would hide: without persisted taps, the first tap
 * on a college suggestion or a date option is eaten by dismissing the keyboard,
 * and the thing has to be tapped twice.
 */
describe("tapping something while the keyboard is up", () => {
  it("lets the tap through instead of only closing the keyboard", async () => {
    const view = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Screen title="Anything">
          <Text>Body</Text>
        </Screen>
      </SafeAreaProvider>,
    );

    // Read off the rendered tree rather than the source, so moving the prop
    // to a different element still counts and removing it still fails.
    expect(JSON.stringify(view.toJSON())).toContain(
      '"keyboardShouldPersistTaps":"handled"',
    );
  });
});
