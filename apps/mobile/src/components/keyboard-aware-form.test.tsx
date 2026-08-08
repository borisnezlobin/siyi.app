import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { Keyboard, Text, TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import {
  KeyboardAwareForm,
  useFieldChain,
} from "@/components/keyboard-aware-form";
import { useKeyboardHeight } from "@/hooks/use-keyboard";
import { mockKeyboardEvents } from "@/test-support/keyboard";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function TestForm({ onSubmit }: { onSubmit?: () => void }) {
  const fieldProps = useFieldChain(["first", "second"], onSubmit);
  return (
    <KeyboardAwareForm
      footer={<Button label="Save changes" onPress={() => undefined} />}
    >
      <FormField label="First" {...fieldProps("first")} />
      <FormField label="Second" {...fieldProps("second")} />
    </KeyboardAwareForm>
  );
}

function renderForm(onSubmit?: () => void) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TestForm onSubmit={onSubmit} />
    </SafeAreaProvider>,
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("a keyboard-aware form", () => {
  it("keeps the action row on screen once the keyboard is up", async () => {
    const keyboard = mockKeyboardEvents();
    await renderForm();
    await keyboard.show();

    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });

  it("puts the action row outside the part that scrolls", async () => {
    await renderForm();

    // A save button that is the last thing in the scroll view is a save button
    // you have to go looking for. It has to be a sibling of the scrolling area,
    // never a child of it.
    const footer = screen.getByTestId("sticky-footer");
    expect(
      within(footer).getByRole("button", { name: "Save changes" }),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("form-scroll")).queryByRole("button", {
        name: "Save changes",
      }),
    ).toBeNull();
  });

  it("has no footer to speak of when the form was given no actions", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <KeyboardAwareForm>
          <FormField label="On its own" />
        </KeyboardAwareForm>
      </SafeAreaProvider>,
    );

    expect(screen.queryByTestId("sticky-footer")).toBeNull();
  });

  it("asks each field to scroll itself into view when it takes focus", async () => {
    await renderForm();

    // The wiring the scrolling area acts on. Without it a field can sit behind
    // the keyboard with nothing prompting the form to move.
    expect(screen.getByLabelText("First").props.onFocus).toEqual(
      expect.any(Function),
    );
    expect(screen.getByLabelText("Second").props.onFocus).toEqual(
      expect.any(Function),
    );
  });

  it("points the return key at the next field rather than at submit", async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);
    const first = screen.getByLabelText("First");

    expect(first.props.returnKeyType).toBe("next");
    expect(first.props.submitBehavior).toBe("submit");
    await fireEvent(first, "submitEditing");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits from the last field instead of moving on", async () => {
    const onSubmit = jest.fn();
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation();
    await renderForm(onSubmit);

    expect(screen.getByLabelText("Second").props.returnKeyType).toBe("done");
    await fireEvent(screen.getByLabelText("Second"), "submitEditing");

    expect(onSubmit).toHaveBeenCalled();
    expect(dismiss).toHaveBeenCalled();
  });

  it("puts the keyboard away when you tap the space around the fields", async () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <KeyboardAwareForm>
          <Text>Somewhere quiet</Text>
          <TextInput accessibilityLabel="Anything" />
        </KeyboardAwareForm>
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByText("Somewhere quiet"));

    expect(dismiss).toHaveBeenCalled();
  });
});

describe("tracking how much the keyboard covers", () => {
  function HeightProbe() {
    return <Text>{`covering ${useKeyboardHeight()}`}</Text>;
  }

  it("reports the height while the keyboard is open and zero once it closes", async () => {
    const keyboard = mockKeyboardEvents();
    await render(<HeightProbe />);

    expect(screen.getByText("covering 0")).toBeTruthy();

    await keyboard.resize(336);
    expect(screen.getByText("covering 336")).toBeTruthy();

    await keyboard.hide();
    expect(screen.getByText("covering 0")).toBeTruthy();
  });

  it("survives a keyboard event that carries no measurements", async () => {
    const keyboard = mockKeyboardEvents();
    await render(<HeightProbe />);

    await keyboard.resizeWithoutMeasurements();

    expect(screen.getByText("covering 0")).toBeTruthy();
  });
});
