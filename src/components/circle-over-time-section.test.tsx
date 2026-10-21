// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CircleOverTimeSection } from "@/components/circle-over-time-section";
import type { CircleMember } from "@/lib/circle-over-time";

const now = new Date(2026, 7, 20, 12, 0, 0);

function met(id: string, month: number, day = 4): CircleMember {
  return {
    id,
    fullName: `Person ${id}`,
    firstMetAt: new Date(2026, month, day).toISOString(),
  };
}

afterEach(cleanup);

describe("the circle section on Today", () => {
  it("says nothing at all to somebody who has met nobody", () => {
    // An empty chart is worse than no chart: it is a reproach with no action.
    const { container } = render(<CircleOverTimeSection people={[]} now={now} />);

    expect(container.innerHTML).toBe("");
  });

  it("names every month in the window, quiet ones included", () => {
    render(<CircleOverTimeSection people={[met("a", 7)]} now={now} />);

    for (const label of ["Mar", "Apr", "May", "Jun", "Jul", "Aug"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("tells a screen reader what the bars are doing", () => {
    // The height is the whole message and it is invisible to anybody not
    // looking at it, so the count exists here and nowhere else.
    render(
      <CircleOverTimeSection
        people={[met("a", 7), met("b", 7, 5), met("c", 5)]}
        now={now}
      />,
    );

    expect(screen.getByText("Aug: 2 people")).toBeTruthy();
    expect(screen.getByText("Jun: one person")).toBeTruthy();
    expect(screen.getByText("Apr: nobody new")).toBeTruthy();
  });

  it("puts no number where a reader can see one", () => {
    const busy = Array.from({ length: 34 }, (_, index) =>
      met(`aug-${index}`, 7, (index % 15) + 1),
    );
    const { container } = render(
      <CircleOverTimeSection people={[...busy, met("q", 3)]} now={now} />,
    );

    // Everything visible is a face, a bar or a month. The counts live in
    // sr-only text, so stripping that should leave no digits behind.
    for (const hidden of container.querySelectorAll(".sr-only")) hidden.remove();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("keeps its shape when one month dwarfs the rest", () => {
    const busy = Array.from({ length: 34 }, (_, index) =>
      met(`aug-${index}`, 7, (index % 15) + 1),
    );
    const { container } = render(
      <CircleOverTimeSection people={[...busy, met("mar", 2)]} now={now} />,
    );

    const heights = Array.from(container.querySelectorAll<HTMLElement>("[style*='height']"))
      .map((node) => Number.parseInt(node.style.height, 10))
      .filter((value) => Number.isFinite(value));

    // The busiest month is full height and the quiet one is still visible —
    // thirty-four against one has to be readable as a difference, not as an
    // empty column beside a full one.
    expect(Math.max(...heights)).toBe(100);
    expect(Math.min(...heights)).toBeGreaterThan(5);
  });
});
