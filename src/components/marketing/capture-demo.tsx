"use client";

import {
  Bell,
  Cake,
  CaretRight,
  Gear,
  House,
  Plus,
  UsersThree,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

/**
 * siyi's own Today screen, being interrupted by siyi.
 *
 * An earlier version of this put the same three messages in a column of dated
 * bubbles and it read as a chat transcript, which is not what the app is or
 * looks like. What the product actually does is arrive on a phone that is not
 * open, so the demo is the real screen with real notifications landing on it.
 *
 * The notifications are positioned absolutely over a fixed-height screen, so
 * nothing in the page moves as they arrive.
 */

const notifications = [
  {
    month: "October",
    time: "6:40 pm",
    title: "You and Amelia have gone quiet",
    body: "Three weeks since the ceramics studio. She was going to show you the kiln.",
  },
  {
    month: "January",
    time: "9:15 am",
    title: "The housing list you promised Amelia",
    body: "You said you would send it on Thursday. It is Thursday.",
  },
  {
    month: "March",
    time: "8:02 am",
    title: "Amelia turns 21 today",
    body: "Her mom mails a card — she would rather have the phone call.",
  },
];

const agenda = [
  {
    icon: UsersThree,
    title: "Check in with Luis",
    meta: "8 days overdue · Aug 2",
    overdue: true,
  },
  {
    icon: Bell,
    title: "Share the campus garden group chat",
    meta: "Amara · Due today",
    overdue: false,
  },
  {
    icon: Cake,
    title: "Amelia’s birthday",
    meta: "In 3 days · turning 21",
    overdue: false,
  },
];

/**
 * One banner at a time, the way a phone actually shows them. Stacking all three
 * buried the header and the coral prompt, which are the parts that make the
 * screen underneath recognisably siyi rather than any list app.
 */
const tabs = [
  { icon: House, label: "Today", active: true },
  { icon: UsersThree, label: "People", active: false },
  { icon: Bell, label: "Reminders", active: false },
  { icon: Gear, label: "Settings", active: false },
];

const typedLine =
  "met amelia at design club — oakland, product design, bday mar 3";

/**
 * The loop opens on the one thing the reader has to do, because three
 * notifications with no origin left it unclear where any of it came from.
 * Capture first, then the months of it paying off.
 */
const sheetOpensAt = 500;
const typingStartsAt = 900;
const typingDuration = 1800;
const savesAt = typingStartsAt + typingDuration + 400;
const sheetClosesAt = savesAt + 600;

const firstAt = sheetClosesAt + 800;
const visibleFor = 1900;
const between = 600;
const slot = visibleFor + between;
const cycleLength = firstAt + slot * notifications.length + 2400;

function visibleNotification(elapsed: number) {
  for (let index = notifications.length - 1; index >= 0; index -= 1) {
    const start = firstAt + slot * index;
    // The last one stays up: it is the payoff, and the loop ends on it.
    const end = index === notifications.length - 1 ? cycleLength : start + visibleFor;
    if (elapsed >= start && elapsed < end) return index;
  }
  return -1;
}

export function CaptureDemo() {
  const [elapsed, setElapsed] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(reduced.matches);
    apply();
    reduced.addEventListener("change", apply);
    return () => reduced.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (still) return;
    const started = performance.now();
    let frame = requestAnimationFrame(function tick() {
      setElapsed((performance.now() - started) % cycleLength);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [still]);

  const current = still ? notifications.length - 1 : visibleNotification(elapsed);
  const reached = still
    ? notifications.length
    : notifications.filter((_, index) => elapsed >= firstAt + slot * index).length;
  const month = reached === 0 ? "September" : notifications[reached - 1].month;

  const sheetOpen = !still && elapsed >= sheetOpensAt && elapsed < sheetClosesAt;
  const saving = !still && elapsed >= savesAt && elapsed < sheetClosesAt;
  const typedCount = still
    ? typedLine.length
    : Math.round(
        Math.min(1, Math.max(0, elapsed - typingStartsAt) / typingDuration) *
          typedLine.length,
      );

  return (
    <div>
      <p className="sr-only">
        A phone showing siyi. Someone types “met amelia at design club —
        oakland, product design, bday mar 3” and saves it. Over the following
        months three notifications arrive on the Today screen: that you and Amelia have gone quiet, that
        you promised her the housing list on Thursday, and that Amelia turns 21
        today.
      </p>

      <div
        aria-hidden="true"
        className="rounded-[2rem] bg-ink px-5 pb-7 pt-5 sm:rounded-[2.5rem] sm:px-8 sm:pb-9 sm:pt-6"
      >
        <p className="text-center text-xs font-semibold text-white/40">{month}</p>

        <div className="relative mx-auto mt-9 w-full max-w-[330px]">
          {/* z-0 makes the screen its own stacking context, so nothing inside
              it — the dimmed content, the sheet — can paint over a notification
              that is meant to be sitting on top of the phone. */}
          <div className="relative z-0 h-[500px] overflow-hidden rounded-[2.25rem] bg-porcelain shadow-float">
          <div
            className={`px-5 pt-6 transition-opacity duration-500 ${
              current >= 0 ? "opacity-70" : "opacity-100"
            }`}
          >
            <p className="font-display text-3xl tracking-[-0.03em]">Today</p>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-coral p-3 text-white">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20">
                <UsersThree size={17} weight="fill" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">
                  Who did you talk to today?
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-white/80">
                  One pass, one tap each
                </span>
              </span>
              <CaretRight size={14} weight="bold" />
            </div>

            <div className="mt-3 grid grid-cols-2 rounded-2xl bg-white py-3">
              <span className="border-r border-ink/8 px-4">
                <span className="block font-display text-2xl">4</span>
                <span className="mt-0.5 block text-[10px] text-ink-muted">
                  need attention
                </span>
              </span>
              <span className="px-4">
                <span className="block font-display text-2xl">3</span>
                <span className="mt-0.5 block text-[10px] text-ink-muted">
                  coming up
                </span>
              </span>
            </div>

            <p className="mt-5 text-sm font-bold">Time-sensitive</p>
            <div className="mt-1">
              {agenda.map(({ icon: Icon, title, meta, overdue }) => (
                <div
                  key={title}
                  className="flex items-center gap-3 border-b border-ink/8 py-3"
                >
                  <Icon
                    size={18}
                    className={overdue ? "shrink-0 text-coral-strong" : "shrink-0 text-ink-muted"}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">
                      {title}
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-[10px] ${
                        overdue ? "text-coral-strong" : "text-ink-muted"
                      }`}
                    >
                      {meta}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* The real capture sheet: a scrim, and the save in the footer where
              the app keeps it rather than below the fold of the content. */}
          <div
            className={`absolute inset-0 z-[5] bg-ink/40 transition-opacity duration-300 ${
              sheetOpen ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute inset-x-0 bottom-0 z-[6] rounded-t-[1.75rem] bg-white p-4 transition-transform duration-300 ease-out ${
              sheetOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <span className="mx-auto block h-1 w-9 rounded-full bg-ink/15" />
            <p className="mt-3 font-display text-lg">What did you find out?</p>
            <p className="mt-2.5 text-[10px] font-semibold text-ink-muted">
              What did you learn?
            </p>
            <div className="mt-1.5 min-h-[62px] rounded-2xl border border-black/10 px-3 py-2.5 text-[12px] leading-5">
              {typedCount > 0 ? (
                <span>
                  {typedLine.slice(0, typedCount)}
                  {typedCount < typedLine.length ? (
                    <span className="ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-coral" />
                  ) : null}
                </span>
              ) : (
                <span className="text-ink/35">Is interested in photography</span>
              )}
            </div>
            <div
              className={`mt-3 grid h-10 place-items-center rounded-2xl text-[12px] font-bold text-white transition-colors duration-300 ${
                saving ? "bg-sage-strong" : "bg-coral"
              }`}
            >
              {saving ? "Saved" : "Save update"}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-ink/8 bg-porcelain/95 px-3 pb-4 pt-2.5 backdrop-blur">
            {tabs.map(({ icon: Icon, label, active }) => (
              <span key={label} className="flex flex-col items-center gap-1">
                <Icon
                  size={19}
                  weight={active ? "fill" : "regular"}
                  className={active ? "text-ink" : "text-ink-muted"}
                />
                <span
                  className={`text-[9px] ${active ? "font-bold" : "text-ink-muted"}`}
                >
                  {label}
                </span>
              </span>
            ))}
            <span className="absolute left-1/2 top-0 grid size-11 -translate-x-1/2 -translate-y-1/3 place-items-center rounded-full bg-coral text-white shadow-float">
              <Plus size={19} weight="bold" />
            </span>
          </div>
        </div>

        {/* Outside the screen's overflow so it can sit over the phone's top
            edge. Laid on top of the header instead, it cut the coral prompt
            in half and the app underneath stopped being recognisable. */}
        {/* z-10 is load-bearing: the screen's dimmed content sets its own
            stacking context, and without this the app's heading paints through
            the notification sitting on top of it. */}
        <div className="absolute inset-x-2 -top-7 z-10">
          {notifications.map((notification, index) => (
            <div
              key={notification.title}
              className={`absolute inset-x-0 top-0 rounded-[1.35rem] bg-white p-3.5 shadow-float transition-all duration-500 ${
                index === current
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-3 opacity-0"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-coral text-white">
                  <UsersThree size={11} weight="fill" />
                </span>
                <span className="text-[10px] font-bold">siyi</span>
                <span className="ml-auto text-[10px] text-ink-muted">
                  {notification.time}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-bold leading-5">
                {notification.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">
                {notification.body}
              </p>
            </div>
          ))}
        </div>
        </div>
      </div>

      <p className="mt-5 text-center text-sm leading-7 text-ink-muted">
        You wrote one line about Amelia in September. Everything above happened
        without you opening the app again.
      </p>
    </div>
  );
}
