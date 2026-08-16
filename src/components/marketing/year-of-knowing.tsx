import { Check } from "@phosphor-icons/react/dist/ssr";

/**
 * Six things Siyi does, told as one year with one person rather than a list.
 *
 * A feature grid asks the reader to imagine when each thing would matter. A
 * dated sequence answers that instead, so every visual below is built for its
 * own moment and none of them share a shape.
 */

/**
 * The date sits on the axis rather than above the heading. As a small coloured
 * line over a title it read as an eyebrow; on the rule, level with its own dot,
 * it reads as what it is — a mark on a timeline.
 */
function Stop({
  when,
  title,
  copy,
  children,
}: {
  when: string;
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[minmax(0,1fr)] gap-y-5 pb-16 pl-7 last:pb-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-8 sm:pl-9 lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-x-12">
      <span
        className="absolute left-0 top-2 size-2.5 -translate-x-1/2 rounded-full bg-coral"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-ink-muted sm:pt-1">{when}</p>
      <div>
        <h3 className="font-display text-[1.7rem] leading-tight tracking-[-0.02em] sm:text-[2rem]">
          {title}
        </h3>
        <p className="mt-3 max-w-md text-sm leading-7 text-ink-muted">{copy}</p>
      </div>
      <div className="sm:col-start-2 lg:col-start-3 lg:row-start-1">
        {children}
      </div>
    </li>
  );
}

const dayNumbers = [1, 2, 3, 4, 5, 6, 7];
const quietWeeks = Array.from({ length: 21 }, (_, index) => index);
const checkedIn = [
  { initials: "LO", name: "Luis", done: true },
  { initials: "AC", name: "Amelia", done: true },
  { initials: "AO", name: "Amara", done: true },
  { initials: "JR", name: "Jonah", done: false },
];

export function YearOfKnowing() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 sm:py-28">
      <div className="max-w-2xl">
        <h2 className="font-display text-[2.6rem] leading-[0.95] tracking-[-0.04em] sm:text-6xl">
          One person. One year.
        </h2>
        <p className="mt-5 text-base leading-8 text-ink-muted">
          None of this is something you have to remember to go and do. You met
          her once and wrote one sentence. Everything below is what happens
          after that, in the order it happens.
        </p>
      </div>

      <ol className="relative mt-14 border-l border-ink/10 sm:mt-16 sm:ml-1">
        <Stop
          when="Next morning"
          title="She’s already in your phone"
          copy="Siyi writes your people into your contacts, so when she texts you first you get a name instead of a number you have to guess at."
        >
          <div className="rounded-[1.75rem] bg-white p-2 shadow-card">
            <div className="rounded-[1.4rem] bg-porcelain px-5 py-6 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-sun font-display text-2xl">
                A
              </span>
              <p className="mt-3 text-lg font-bold">Amelia Chen</p>
            </div>
            <dl className="mt-2 space-y-2 px-1 pb-1">
              <div className="rounded-2xl bg-porcelain px-4 py-3">
                <dt className="text-[11px] text-ink-muted">mobile</dt>
                <dd className="text-sm font-semibold text-sage-strong">
                  (415) 555-0142
                </dd>
              </div>
              <div className="rounded-2xl bg-sun/35 px-4 py-3">
                <dt className="text-[11px] text-ink/60">notes</dt>
                <dd className="text-sm leading-6">
                  Design club. From Oakland, studying product design. Building a
                  campus thrift map.
                </dd>
              </div>
            </dl>
          </div>
        </Stop>

        <Stop
          when="Tuesday night"
          title="Say who you saw, in four taps"
          copy="Siyi guesses at who you probably ran into and asks once a day. Tapping a name is the whole interaction, and it is how everything else knows when you last spoke."
        >
          <div className="rounded-[1.75rem] bg-white p-5 shadow-card sm:p-6">
            <p className="text-sm font-bold">Who did you see today?</p>
            <div className="mt-4 space-y-2">
              {checkedIn.map((person) => (
                <div
                  key={person.name}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                    person.done ? "bg-sage" : "bg-porcelain"
                  }`}
                >
                  <span className="grid size-9 place-items-center rounded-full bg-white text-[11px] font-bold">
                    {person.initials}
                  </span>
                  <span className="flex-1 text-sm font-semibold">
                    {person.name}
                  </span>
                  <span
                    className={`grid size-6 place-items-center rounded-full ${
                      person.done ? "bg-sage-strong text-white" : "bg-white"
                    }`}
                  >
                    {person.done ? (
                      <Check size={13} weight="bold" aria-hidden="true" />
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Stop>

        <Stop
          when="Three weeks in"
          title="A nudge before it gets awkward"
          copy="Most friendships go quiet long before they end, and the longer the quiet runs the harder it is to break. Siyi keeps count and says something early, while a text is still just a text."
        >
          <div className="rounded-[1.75rem] bg-white p-5 shadow-card sm:p-7">
            <div className="flex items-end gap-1" aria-hidden="true">
              {quietWeeks.map((day) => (
                <span
                  key={day}
                  className="flex-1 rounded-full bg-ink"
                  style={{
                    height: `${52 - day * 1.7}px`,
                    opacity: 0.5 - day * 0.021,
                  }}
                />
              ))}
              <span className="ml-1 h-14 w-1.5 shrink-0 rounded-full bg-coral" />
            </div>
            <p className="mt-5 text-sm font-bold">
              You and Amelia have gone quiet.
            </p>
            <p className="mt-1.5 text-xs leading-6 text-ink-muted">
              Twenty-one days since the ceramics studio. She was going to show
              you the kiln.
            </p>
          </div>
        </Stop>

        <Stop
          when="January"
          title="The follow-up you meant to do"
          copy="Say you’ll send her the housing list and set it for Thursday. It waits with her name on it and turns up that morning, so the thing you promised actually gets done."
        >
          <div className="space-y-3">
            <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-4 shadow-card">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-coral text-white">
                <span className="block text-center leading-none">
                  <span className="block text-[10px] font-semibold">Thu</span>
                  <span className="mt-0.5 block font-display text-xl">14</span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  Send Amelia the off-campus housing list
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  You said you would at the studio
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4 rounded-[1.5rem] bg-white/60 p-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-mist">
                <span className="block text-center leading-none text-ink-muted">
                  <span className="block text-[10px] font-semibold">Sun</span>
                  <span className="mt-0.5 block font-display text-xl">24</span>
                </span>
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-ink-muted">
                Ask Luis about the radio lineup
              </span>
            </div>
          </div>
        </Stop>

        <Stop
          when="March 3"
          title="Nobody has to remind you about a birthday"
          copy="Every birthday you’ve ever written down sits on one calendar, and the ones coming up reach you the morning of. No app has to be open for that to work."
        >
          <div className="rounded-[1.75rem] bg-ink p-5 shadow-float sm:p-7">
            <div className="flex justify-between gap-1.5" aria-hidden="true">
              {dayNumbers.map((day) => (
                <span
                  key={day}
                  className={`grid h-16 flex-1 place-items-center rounded-2xl text-sm font-semibold ${
                    day === 3
                      ? "bg-sun text-ink"
                      : "bg-white/[0.07] text-white/40"
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-sm font-bold">Amelia turns 21 today</p>
              <p className="mt-1 text-xs leading-6 text-ink-muted">
                Her mom still mails a card. She’d rather have the phone call.
              </p>
            </div>
          </div>
        </Stop>

        <Stop
          when="Every time"
          title="You get the last word"
          copy="Siyi shows you what it worked out from your sentence and waits. Keep the parts that are right, throw out the parts that aren’t, and nothing else is saved."
        >
          <div className="rounded-[1.75rem] bg-white p-5 shadow-card sm:p-6">
            <p className="font-display text-xl">Here is what I found</p>
            <div className="mt-4 space-y-2">
              {[
                { label: "Birthday", value: "March 3", kept: true },
                { label: "Studying", value: "Product design", kept: true },
                { label: "Hometown", value: "Oakland, California", kept: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${
                    item.kept ? "bg-porcelain" : "bg-porcelain/50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] text-ink-muted">
                      {item.label}
                    </span>
                    <span
                      className={`block text-sm font-semibold ${
                        item.kept ? "" : "text-ink-muted line-through"
                      }`}
                    >
                      {item.value}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                      item.kept
                        ? "bg-sage-strong text-white"
                        : "bg-white text-ink-muted"
                    }`}
                  >
                    {item.kept ? "Keeping" : "Dropped"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Stop>
      </ol>
    </section>
  );
}
