import Link from "next/link";
import { Avatar } from "@/components/avatar";
import {
  circleMonthFaces,
  circleMonthHeight,
  circleOverTime,
  circleScale,
  hasCircleHistory,
  type CircleMember,
} from "@/lib/circle-over-time";

/**
 * Your circle, month by month, on Today.
 *
 * Height says how many, a face says who. Stacking one avatar per person was the
 * first idea and it only reads up to about six — a circle here passes a hundred,
 * so a busy month holds thirty and the stack either runs off the top or gets
 * capped, and either way a month of twenty and a month of thirty-four draw the
 * same. A bar measured against the busiest month keeps working at any size, and
 * the newest face riding on top keeps it about people rather than volume.
 *
 * Nothing here is counted at the reader. No total, no average, no "up from last
 * month" — the strongest claim it makes is that one month was fuller than
 * another, which is exactly as much as the data supports and the most the store
 * listing's promise of no scores allows.
 */
export function CircleOverTimeSection({
  people,
  now = new Date(),
}: {
  people: CircleMember[];
  now?: Date;
}) {
  const months = circleOverTime(people, now);
  if (!hasCircleHistory(months)) return null;

  const scale = circleScale(months);

  return (
    <section className="mt-9" aria-labelledby="circle-heading">
      <h2 id="circle-heading" className="text-base font-bold">
        Your circle
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Who you have been meeting, month by month.
      </p>

      <div className="mt-4 rounded-3xl bg-white p-5">
        <ol className="flex h-[132px] items-end gap-2">
          {months.map((month) => {
            const { faces } = circleMonthFaces(month);
            const height = circleMonthHeight(month, scale);
            const met = month.people.length;

            return (
              <li
                key={month.key}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="flex w-full flex-1 flex-col items-center justify-end">
                  {faces.length ? (
                    <span className="z-10 -mb-1 flex flex-col items-center">
                      {faces.map((person, index) => (
                        <span
                          key={person.id}
                          className={
                            index === 0
                              ? "ring-2 ring-white rounded-full"
                              : "-mt-3.5 rounded-full opacity-85 ring-2 ring-white"
                          }
                        >
                          <Avatar
                            name={person.preferredName || person.fullName}
                            imageUrl={person.profilePhotoUrl}
                            size="xs"
                          />
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span
                      className="mb-1 size-1.5 rounded-full bg-mist"
                      aria-hidden="true"
                    />
                  )}
                  {height > 0 ? (
                    <span
                      className={`w-5 rounded-t-lg ${
                        month.current ? "bg-sage-strong" : "bg-sage"
                      }`}
                      style={{ height: `${Math.round(height * 100)}%` }}
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span
                  className={`text-[11px] ${
                    month.current ? "font-semibold text-ink" : "text-ink-muted"
                  }`}
                >
                  {month.label}
                </span>
                {/* The only place a count exists is for a screen reader, which
                    cannot see a bar and would otherwise be told nothing at all. */}
                <span className="sr-only">
                  {met === 0
                    ? `${month.label}: nobody new`
                    : met === 1
                      ? `${month.label}: one person`
                      : `${month.label}: ${met} people`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <Link
        href="/people"
        className="mt-3 inline-flex text-sm font-semibold text-ink transition-colors hover:text-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        See everyone
      </Link>
    </section>
  );
}
