import { fireEvent, render, screen } from "@testing-library/react-native";
import { ContactMethodField } from "@/components/contact-method-field";
import type { ContactMethodDraft } from "@/lib/contact-methods";

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));

// The bottom sheet drags in the worklets runtime, which has no place in a
// test that only renders plain fields.
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

async function renderField(drafts: ContactMethodDraft[]) {
  const onChange = jest.fn();
  await render(
    <ContactMethodField drafts={drafts} kind="phone" onChange={onChange} />,
  );
  return onChange;
}

describe("a single row", () => {
  const oneNumber: ContactMethodDraft[] = [
    { kind: "phone", value: "(555) 555-0123", label: null, isPrimary: true },
  ];

  it("is the plain field it has always been", async () => {
    await renderField(oneNumber);

    expect(screen.getByLabelText("Phone")).toBeTruthy();
    expect(screen.queryByLabelText("Label")).toBeNull();
    expect(screen.queryByLabelText("Main number")).toBeNull();
    expect(screen.queryByLabelText("Remove this number")).toBeNull();
  });

  it("offers a second one", async () => {
    const onChange = await renderField(oneNumber);
    await fireEvent.press(screen.getByText("Add another number"));

    expect(onChange).toHaveBeenCalledWith([
      ...oneNumber,
      { kind: "phone", value: "", label: null, isPrimary: false },
    ]);
  });
});

describe("a second row", () => {
  const twoNumbers: ContactMethodDraft[] = [
    { kind: "phone", value: "(555) 555-0123", label: null, isPrimary: true },
    { kind: "phone", value: "(555) 555-0124", label: "home", isPrimary: false },
  ];

  it("brings the label, the main marker and the remove button with it", async () => {
    await renderField(twoNumbers);

    expect(screen.getByLabelText("Phone 1")).toBeTruthy();
    expect(screen.getByLabelText("Phone 2")).toBeTruthy();
    expect(screen.getAllByLabelText("Label")).toHaveLength(2);
    expect(screen.getByLabelText("Main number")).toBeTruthy();
    expect(screen.getByLabelText("Make this the main number")).toBeTruthy();
    expect(screen.getAllByLabelText("Remove this number")).toHaveLength(2);
  });

  it("moves the main marker to the row that was tapped", async () => {
    const onChange = await renderField(twoNumbers);
    await fireEvent.press(screen.getByLabelText("Make this the main number"));

    expect(
      onChange.mock.calls[0][0].map((row: ContactMethodDraft) => row.isPrimary),
    ).toEqual([false, true]);
  });

  it("promotes the next number when the main one goes", async () => {
    const onChange = await renderField(twoNumbers);
    await fireEvent.press(screen.getAllByLabelText("Remove this number")[0]);

    expect(onChange).toHaveBeenCalledWith([
      { kind: "phone", value: "(555) 555-0124", label: "home", isPrimary: true },
    ]);
  });
});
