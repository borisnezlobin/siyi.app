import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { render, screen } from "@testing-library/react-native";
import { useEffect, useRef } from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { sheetScrollTestId, sheetSpy } from "@/test-support/bottom-sheet";
import { mockKeyboardEvents } from "@/test-support/keyboard";

jest.mock("@gorhom/bottom-sheet", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/test-support/bottom-sheet").bottomSheetMock(),
);

import {
  AppBottomSheet,
  AppBottomSheetScrollView,
} from "@/components/app-bottom-sheet";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const keyboard = mockKeyboardEvents();

/** Nothing is on screen until a sheet is presented, exactly as in the app. */
function PresentedSheet() {
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    ref.current?.present();
  }, []);

  return (
    <AppBottomSheet footer={<Text>Save reminder</Text>} ref={ref}>
      <AppBottomSheetScrollView>
        <Text>What do you want to remember?</Text>
      </AppBottomSheetScrollView>
    </AppBottomSheet>
  );
}

function renderSheet() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PresentedSheet />
    </SafeAreaProvider>,
  );
}

function paddingBelowContent() {
  const style = screen.getByTestId(sheetScrollTestId).props.contentContainerStyle;
  const flattened = (Array.isArray(style) ? style : [style]).filter(Boolean);
  return flattened.reduce(
    (found: number, entry: { paddingBottom?: number }) =>
      typeof entry?.paddingBottom === "number" ? entry.paddingBottom : found,
    0,
  );
}

/**
 * The sheet is lifted whole above the keyboard, and its ceiling comes down by
 * the same amount. Anything that also pads the content by the keyboard height
 * has subtracted it twice, which on a small screen leaves no room at all for
 * the field being typed in — the form collapses to a sliver with the title cut
 * in half. It has happened once; this is what would catch it happening again.
 */
describe("a sheet with the keyboard up", () => {
  it("brings its ceiling down by the keyboard, exactly once", async () => {
    await renderSheet();

    const openHeight = sheetSpy.props.maxDynamicContentSize as number;
    await keyboard.resize(336);
    const raisedHeight = sheetSpy.props.maxDynamicContentSize as number;

    expect(openHeight - raisedHeight).toBe(336);
  });

  it("does not leave room for the keyboard a second time inside the content", async () => {
    await renderSheet();

    const closed = paddingBelowContent();
    await keyboard.resize(336);

    expect(paddingBelowContent()).toBe(closed);
  });

  it("still leaves what the form needs once the keyboard is up", async () => {
    await renderSheet();
    await keyboard.resize(336);

    const maxHeight = sheetSpy.props.maxDynamicContentSize as number;

    // Whatever the footer takes, the form must not be squeezed to nothing.
    expect(maxHeight - paddingBelowContent()).toBeGreaterThan(300);
  });
});
