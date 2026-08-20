/**
 * Your circle, month by month — the people, not the count.
 *
 * The question this answers is "have I been meeting anyone lately?", and the
 * honest way to answer it is with the faces themselves. A number would be
 * easier to draw and worse to read: nobody knows whether four is a good month,
 * but everybody can see that this month is fuller than last.
 *
 * Deliberately no total, no average and no comparison with last month. Those
 * turn a look back into a score, and a score is the thing this app promises in
 * its own store listing not to keep.
 */

export type CircleMember = {
  id: string;
  fullName: string;
  preferredName?: string | null;
  profilePhotoUrl?: string | null;
  firstMetAt: string;
  status?: string;
};

export type CircleMonth<T extends CircleMember> = {
  /** `2026-08`, stable to sort and to use as a key. */
  key: string;
  /** "Aug" — sentence case, never shouted. */
  label: string;
  /** Whether this is the month happening now. */
  current: boolean;
  /** Everyone first met that month, newest first. */
  people: T[];
};

/** How many months of history the strip shows. Half a year reads at a glance. */
export const circleMonthCount = 6;

/**
 * How many faces ride on top of a month.
 *
 * A circle here reaches a hundred people and more, so a month can hold thirty —
 * and thirty stacked circles is neither small nor readable. Stacking a face per
 * person only works up to about six, which is why it is not what this does.
 * Height carries how many; the face carries who. One or two is enough to make
 * the month a person rather than a bar, and it costs the same space whether the
 * month held three people or forty.
 */
export const circleFacesPerMonth = 2;

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The months to draw, oldest first, including the ones where you met nobody.
 *
 * A gap is information — a quiet April between two busy months is the shape
 * worth seeing — so empty months are kept rather than skipped.
 */
export function circleOverTime<T extends CircleMember>(
  people: T[],
  now = new Date(),
  months = circleMonthCount,
): CircleMonth<T>[] {
  const buckets = new Map<string, T[]>();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  for (const person of people) {
    if (person.status === "archived") continue;
    const met = new Date(person.firstMetAt);
    if (Number.isNaN(met.getTime())) continue;
    if (met.getTime() < start.getTime()) continue;
    // Somebody met "tomorrow" is a typo or a clock, not a month to draw.
    if (met.getTime() > now.getTime()) continue;

    const key = monthKey(met);
    const held = buckets.get(key);
    if (held) held.push(person);
    else buckets.set(key, [person]);
  }

  const thisMonth = monthKey(now);
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    const key = monthKey(date);
    const met = (buckets.get(key) ?? []).sort(
      (left, right) =>
        new Date(right.firstMetAt).getTime() - new Date(left.firstMetAt).getTime(),
    );
    return {
      key,
      label: monthLabels[date.getMonth()],
      current: key === thisMonth,
      people: met,
    };
  });
}

/**
 * The faces to draw for a month, and how many places are left over.
 *
 * Split here rather than in the markup so both apps crop the same way and a
 * test can say what happens at the edge.
 */
export function circleMonthFaces<T extends CircleMember>(
  month: CircleMonth<T>,
  limit = circleFacesPerMonth,
) {
  return {
    faces: month.people.slice(0, limit),
    overflow: Math.max(0, month.people.length - limit),
  };
}

/**
 * The busiest month in the window, which is what every bar is drawn against.
 *
 * Relative, and it does not pretend otherwise: there is no axis and no number,
 * so the only claim being made is that this month was fuller than that one.
 * Returns at least 1 so a window with nobody in it cannot divide by zero.
 */
export function circleScale<T extends CircleMember>(months: CircleMonth<T>[]) {
  return Math.max(1, ...months.map((month) => month.people.length));
}

/**
 * How tall a month's bar is, from 0 to 1.
 *
 * A month with anybody in it never draws as nothing — the smallest bar is still
 * visibly a bar, because "one person" and "no people" are different answers and
 * a hairline would read as the second.
 */
export function circleMonthHeight<T extends CircleMember>(
  month: CircleMonth<T>,
  scale: number,
) {
  if (month.people.length === 0) return 0;
  const share = month.people.length / scale;
  return Math.max(0.18, Math.min(1, share));
}

/** Whether there is anything worth drawing at all. */
export function hasCircleHistory<T extends CircleMember>(months: CircleMonth<T>[]) {
  return months.some((month) => month.people.length > 0);
}
