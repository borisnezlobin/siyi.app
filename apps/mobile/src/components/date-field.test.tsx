import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { DateField } from "@/components/date-field";

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

function Harness({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <DateField label="Birthday" onChangeText={setValue} value={value} />;
}

async function typeBirthday(text: string) {
  await render(<Harness />);
  await fireEvent.changeText(screen.getByLabelText("Birthday"), text);
}

describe("DateField", () => {
  it("reads a typed date back in words", async () => {
    await typeBirthday("18/03/2004");

    expect(screen.getByText("March 18, 2004")).toBeTruthy();
  });

  it("reads a month-first date the same way", async () => {
    await typeBirthday("03/18/2004");

    expect(screen.getByText("March 18, 2004")).toBeTruthy();
  });

  it("says so rather than guessing when it cannot read the date", async () => {
    await typeBirthday("sometime in march");

    expect(screen.getByText("Not a date we can read yet")).toBeTruthy();
  });

  it("says nothing about an empty field", async () => {
    await render(<Harness />);

    expect(screen.queryByText("Not a date we can read yet")).toBeNull();
  });

  it("settles on the stored shape once the field is left", async () => {
    await typeBirthday("March 18 2004");
    await fireEvent(screen.getByLabelText("Birthday"), "blur");

    expect(screen.getByLabelText("Birthday").props.value).toBe("2004-03-18");
  });

  it("offers a calendar as well as the keyboard", async () => {
    await render(<Harness />);

    const picker = screen.getByLabelText("Birthday: pick from a calendar");
    expect(picker).toBeTruthy();

    await fireEvent.press(picker);
    expect(screen.getByLabelText("Birthday: pick from a calendar")).toBeTruthy();
    expect(screen.getByText("Close calendar")).toBeTruthy();
  });
});
