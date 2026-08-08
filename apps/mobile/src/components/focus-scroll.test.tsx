import { fireEvent, render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import {
  FocusScrollProvider,
  RevealingTextInput,
  scrollOffsetToRevealField,
} from "@/components/focus-scroll";
import { FormField } from "@/components/form-field";

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

// A 390x844 phone with a 336pt keyboard and a 78pt pinned footer: the field has
// to end up above 844 - 336 - 78 = 430.
const viewportTop = 120;
const viewportBottom = 430;

describe("working out how far to scroll for the field being typed in", () => {
  it("leaves the offset alone when the field is already clear", () => {
    expect(
      scrollOffsetToRevealField({
        currentOffset: 40,
        fieldTop: 300,
        fieldHeight: 52,
        viewportTop,
        viewportBottom,
      }),
    ).toBe(40);
  });

  it("scrolls a field that the keyboard is covering fully into view", () => {
    // Bottom lands at 604, which is 190 past the 430 the keyboard leaves, plus
    // the 16 of breathing room.
    expect(
      scrollOffsetToRevealField({
        currentOffset: 0,
        fieldTop: 500,
        fieldHeight: 104,
        viewportTop,
        viewportBottom,
      }),
    ).toBe(190);
  });

  it("counts from wherever the area is already scrolled to", () => {
    expect(
      scrollOffsetToRevealField({
        currentOffset: 60,
        fieldTop: 500,
        fieldHeight: 104,
        viewportTop,
        viewportBottom,
      }),
    ).toBe(250);
  });

  it("keeps the top of a field taller than the space that is left", () => {
    // A 400pt field cannot fit in the 310 the keyboard leaves. Showing its
    // bottom would put the line being typed off the top of the area, so the
    // scroll stops the moment the top of the field reaches it.
    expect(
      scrollOffsetToRevealField({
        currentOffset: 0,
        fieldTop: 300,
        fieldHeight: 400,
        viewportTop,
        viewportBottom,
      }),
    ).toBe(164);
  });

  it("scrolls back up for a field that has gone off the top", () => {
    expect(
      scrollOffsetToRevealField({
        currentOffset: 200,
        fieldTop: 60,
        fieldHeight: 52,
        viewportTop,
        viewportBottom,
      }),
    ).toBe(124);
  });

  it("never asks for a negative offset", () => {
    expect(
      scrollOffsetToRevealField({
        currentOffset: 10,
        fieldTop: 0,
        fieldHeight: 52,
        viewportTop,
        viewportBottom,
      }),
    ).toBe(0);
  });
});

describe("fields telling the area around them that they have focus", () => {
  function probe(reveal: jest.Mock, children: React.ReactNode) {
    return render(
      <FocusScrollProvider value={{ reveal }}>
        <View>{children}</View>
      </FocusScrollProvider>,
    );
  }

  it("reports a form field the moment it is focused", async () => {
    const reveal = jest.fn();
    await probe(reveal, <FormField label="What did you do?" />);

    await fireEvent(screen.getByLabelText("What did you do?"), "focus");

    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("reports a field inside a sheet the same way", async () => {
    const reveal = jest.fn();
    await probe(reveal, <FormField bottomSheet label="Anything to remember?" />);

    await fireEvent(screen.getByLabelText("Anything to remember?"), "focus");

    expect(reveal).toHaveBeenCalled();
  });

  it("reports a plain input such as a search box", async () => {
    const reveal = jest.fn();
    await probe(
      reveal,
      <RevealingTextInput accessibilityLabel="Search people" />,
    );

    await fireEvent(screen.getByLabelText("Search people"), "focus");

    expect(reveal).toHaveBeenCalled();
  });

  it("still runs the caller's own focus handler", async () => {
    const reveal = jest.fn();
    const onFocus = jest.fn();
    await probe(reveal, <FormField label="Hometown" onFocus={onFocus} />);

    await fireEvent(screen.getByLabelText("Hometown"), "focus");

    expect(onFocus).toHaveBeenCalled();
  });

  it("leaves a field used outside any scrolling area alone", async () => {
    await render(<FormField label="Nowhere in particular" />);

    // No provider, nothing to scroll, and nothing thrown.
    await fireEvent(screen.getByLabelText("Nowhere in particular"), "focus");

    expect(screen.getByLabelText("Nowhere in particular")).toBeTruthy();
  });
});
