import { describe, expect, it } from "vitest";
import {
  circleMonthFaces,
  circleMonthHeight,
  circleOverTime,
  circleScale,
  hasCircleHistory,
  type CircleMember,
} from "@/lib/circle-over-time";

const now = new Date(2026, 7, 20, 12, 0, 0); // Thursday 20 August 2026

function person(id: string, metAt: string, extra: Partial<CircleMember> = {}) {
  return { id, fullName: `Person ${id}`, firstMetAt: metAt, ...extra };
}

describe("circleOverTime", () => {
  it("gives six months, oldest first, ending on this one", () => {
    const months = circleOverTime([], now);

    expect(months.map((month) => month.label)).toEqual([
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
    ]);
    expect(months.at(-1)?.current).toBe(true);
    expect(months.filter((month) => month.current)).toHaveLength(1);
  });

  it("keeps a month where you met nobody", () => {
    // The gap is the point. A quiet April between two busy months is the shape
    // worth seeing, so it cannot be skipped.
    const months = circleOverTime(
      [person("a", "2026-03-04T10:00:00Z"), person("b", "2026-05-04T10:00:00Z")],
      now,
    );

    expect(months.map((month) => month.people.length)).toEqual([1, 0, 1, 0, 0, 0]);
  });

  it("puts each person in the month you met them, newest first", () => {
    const months = circleOverTime(
      [
        person("early", "2026-08-02T10:00:00Z"),
        person("late", "2026-08-19T10:00:00Z"),
        person("middle", "2026-08-11T10:00:00Z"),
      ],
      now,
    );

    expect(months.at(-1)?.people.map((entry) => entry.id)).toEqual([
      "late",
      "middle",
      "early",
    ]);
  });

  it("leaves out anyone archived", () => {
    const months = circleOverTime(
      [
        person("kept", "2026-08-04T10:00:00Z"),
        person("gone", "2026-08-05T10:00:00Z", { status: "archived" }),
      ],
      now,
    );

    expect(months.at(-1)?.people.map((entry) => entry.id)).toEqual(["kept"]);
  });

  it("ignores anything older than the window, and anything in the future", () => {
    const months = circleOverTime(
      [
        person("ancient", "2024-01-04T10:00:00Z"),
        // A clock or a typo, not a month to draw.
        person("tomorrow", "2026-09-04T10:00:00Z"),
        person("here", "2026-08-04T10:00:00Z"),
      ],
      now,
    );

    expect(months.flatMap((month) => month.people).map((entry) => entry.id)).toEqual([
      "here",
    ]);
  });

  it("survives a date it cannot read rather than throwing", () => {
    const months = circleOverTime([person("bad", "not a date")], now);

    expect(hasCircleHistory(months)).toBe(false);
  });
});

describe("circleMonthFaces", () => {
  it("shows a face or two whatever the size of the month", () => {
    // A circle here reaches a hundred people, so a month can hold thirty. The
    // faces say who, not how many — the height says how many.
    const busy = Array.from({ length: 30 }, (_, index) =>
      person(String(index), `2026-08-${String((index % 15) + 1).padStart(2, "0")}T10:00:00Z`),
    );
    const month = circleOverTime(busy, now).at(-1)!;

    expect(circleMonthFaces(month).faces).toHaveLength(2);
  });

  it("has nothing left over when the month is small", () => {
    const month = circleOverTime([person("a", "2026-08-04T10:00:00Z")], now).at(-1)!;

    expect(circleMonthFaces(month)).toMatchObject({ overflow: 0 });
  });
});

/**
 * The part that has to hold for a big circle. Stacking one shape per person
 * stops reading at about six; drawing a height against the busiest month keeps
 * reading whether that month held four people or forty.
 */
describe("how tall a month draws", () => {
  const monthsWith = (counts: number[]) => {
    const people = counts.flatMap((count, index) =>
      Array.from({ length: count }, (_, seat) =>
        person(
          `${index}-${seat}`,
          // Days stay early in the month: `now` is the 20th, and anyone "met"
          // after today is correctly ignored, which would skew the fixture.
          `2026-0${index + 3}-${String((seat % 15) + 1).padStart(2, "0")}T10:00:00Z`,
        ),
      ),
    );
    return circleOverTime(people, now);
  };

  it("measures every month against the busiest one", () => {
    const months = monthsWith([10, 0, 5, 0, 0, 40]);
    const scale = circleScale(months);

    expect(scale).toBe(40);
    expect(circleMonthHeight(months[5], scale)).toBe(1);
    expect(circleMonthHeight(months[0], scale)).toBeCloseTo(0.25);
  });

  it("draws an empty month as empty and a quiet one as visible", () => {
    const months = monthsWith([1, 0, 0, 0, 0, 40]);
    const scale = circleScale(months);

    // Nobody is nothing; one person is small but never a hairline, because
    // "one" and "none" are different answers.
    expect(circleMonthHeight(months[1], scale)).toBe(0);
    expect(circleMonthHeight(months[0], scale)).toBeGreaterThan(0.1);
  });

  it("cannot divide by zero when nobody has been met at all", () => {
    const months = circleOverTime([], now);

    expect(circleScale(months)).toBe(1);
    expect(circleMonthHeight(months[0], circleScale(months))).toBe(0);
  });
});

describe("hasCircleHistory", () => {
  it("is false for somebody who has met nobody in six months", () => {
    expect(hasCircleHistory(circleOverTime([], now))).toBe(false);
  });

  it("is true as soon as there is one person to show", () => {
    expect(
      hasCircleHistory(circleOverTime([person("a", "2026-06-04T10:00:00Z")], now)),
    ).toBe(true);
  });
});
