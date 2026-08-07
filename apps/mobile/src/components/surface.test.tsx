import { fireEvent, render, screen } from "@testing-library/react-native";
import { ClockCountdown, NotePencil } from "phosphor-react-native";
import { SectionAction, SectionHeading } from "@/components/surface";

describe("SectionHeading", () => {
  it("gives every action words, not just a glyph", async () => {
    await render(
      <SectionHeading
        actions={
          <>
            <SectionAction
              icon={ClockCountdown}
              label="Add reminder"
              onPress={() => {}}
            />
            <SectionAction icon={NotePencil} label="Add update" onPress={() => {}} />
          </>
        }
        detail="2 open"
        title="Reminders"
      />,
    );

    expect(screen.getByText("Reminders")).toBeTruthy();
    expect(screen.getByText("2 open")).toBeTruthy();
    expect(screen.getByText("Add reminder")).toBeTruthy();
    expect(screen.getByText("Add update")).toBeTruthy();
  });

  it("runs the action behind its label", async () => {
    const onPress = jest.fn();
    await render(
      <SectionHeading
        actions={<SectionAction icon={NotePencil} label="Add update" onPress={onPress} />}
        title="History"
      />,
    );

    await fireEvent.press(screen.getByText("Add update"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
