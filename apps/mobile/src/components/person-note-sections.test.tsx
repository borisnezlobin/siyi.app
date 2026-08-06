import { fireEvent, render, screen } from "@testing-library/react-native";
import { PersonNoteSections } from "@/components/person-note-sections";
import type { PersonNote } from "@/lib/types";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: jest.requireActual("react-native").TextInput,
}));

jest.mock("@/lib/data", () => ({
  createPersonNote: jest.fn(),
  deletePersonNote: jest.fn(),
  movePersonNote: jest.fn(),
  savePersonNote: jest.fn(),
}));

import {
  createPersonNote,
  movePersonNote,
  savePersonNote,
} from "@/lib/data";

const userId = "user-1";
const personId = "person-1";

function note(overrides: Partial<PersonNote> = {}): PersonNote {
  return {
    id: "note-1",
    personId,
    userId,
    heading: "Interests",
    body: "Climbing.",
    position: 0,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function renderSections({
  available = true,
  initialSections = [] as PersonNote[],
  headingsUsedElsewhere = [] as string[],
} = {}) {
  return render(
    <PersonNoteSections
      available={available}
      headingsUsedElsewhere={headingsUsedElsewhere}
      initialSections={initialSections}
      personId={personId}
      userId={userId}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (createPersonNote as jest.Mock).mockResolvedValue(
    note({ id: "note-new", heading: "Family", body: "" }),
  );
  (movePersonNote as jest.Mock).mockResolvedValue([]);
  (savePersonNote as jest.Mock).mockResolvedValue(undefined);
});

describe("before migration 0010 has run", () => {
  it("shows nothing at all", async () => {
    await renderSections({ available: false });
    expect(screen.queryByLabelText("New section")).toBeNull();
  });
});

describe("adding a section", () => {
  it("offers headings used on other people, minus the ones already here", async () => {
    await renderSections({
      initialSections: [note({ heading: "Interests" })],
      headingsUsedElsewhere: ["Interests", "Family", "Food"],
    });

    expect(screen.getByText("Family")).toBeTruthy();
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.queryAllByText("Interests")).toHaveLength(0);
  });

  it("adds one straight from a suggestion", async () => {
    await renderSections({ headingsUsedElsewhere: ["Family"] });
    await fireEvent.press(screen.getByText("Family"));

    expect(createPersonNote).toHaveBeenCalledWith(userId, personId, "Family");
  });

  it("adds the heading that was typed", async () => {
    await renderSections();
    await fireEvent.changeText(screen.getByLabelText("New section"), "Food");
    await fireEvent.press(screen.getByLabelText("Add section"));

    expect(createPersonNote).toHaveBeenCalledWith(userId, personId, "Food");
  });

  it("says so when there is no room for another", async () => {
    await renderSections({
      initialSections: Array.from({ length: 30 }, (_, index) =>
        note({ id: `note-${index}`, heading: `Heading ${index}`, position: index }),
      ),
    });

    expect(
      screen.getByText("That is as many sections as one person can hold."),
    ).toBeTruthy();
  });
});

describe("editing a section", () => {
  it("only offers to save once something changed", async () => {
    await renderSections({ initialSections: [note()] });
    expect(screen.queryByText("Save section")).toBeNull();

    await fireEvent.changeText(
      screen.getByLabelText("Interests notes"),
      "Climbing and pottery.",
    );
    await fireEvent.press(screen.getByText("Save section"));

    expect(savePersonNote).toHaveBeenCalledWith(userId, note(), {
      heading: "Interests",
      body: "Climbing and pottery.",
    });
  });

  it("moves a section down and shows the new order", async () => {
    const first = note({ id: "note-1", heading: "Interests", position: 0 });
    const second = note({ id: "note-2", heading: "Family", position: 1 });
    (movePersonNote as jest.Mock).mockResolvedValue([
      { ...second, position: 0 },
      { ...first, position: 1 },
    ]);
    await renderSections({ initialSections: [first, second] });

    await fireEvent.press(screen.getByLabelText("Move Interests down"));

    expect(movePersonNote).toHaveBeenCalledWith(userId, first, "down");
    expect(screen.getByLabelText("Move Family up").props.accessibilityState)
      .toMatchObject({ disabled: true });
  });

  it("cannot move the ends any further", async () => {
    const first = note({ id: "note-1", heading: "Interests", position: 0 });
    const second = note({ id: "note-2", heading: "Family", position: 1 });
    await renderSections({ initialSections: [first, second] });

    expect(
      screen.getByLabelText("Move Interests up").props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(
      screen.getByLabelText("Move Family down").props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});
