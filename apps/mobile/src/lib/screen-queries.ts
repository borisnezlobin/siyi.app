import { getClasses } from "@/lib/classes-data";
import {
  getAccountSettings,
  getAccountSettingsCached,
  getPeople,
  getPeopleCached,
  getReminders,
  getRemindersCached,
  type AccountSettings,
} from "@/lib/data";
import { loadQuery, queryUpdatedAt } from "@/lib/query-cache";
import type { PersonClass } from "@/lib/classes";
import type { Person, Reminder } from "@/lib/types";

/**
 * What the two tabs need, in one place, so it can be fetched before either of
 * them is opened.
 *
 * Defined as inline closures inside the screens, these could only ever run once
 * a screen was mounted, which is why the first visit to a tab always cost a
 * full round trip behind a spinner. Nothing about that data depends on the
 * screen being on the display.
 */

export const todayQueryKey = "today";
export const peopleTabQueryKey = "peopleTab";

export type TodayData = {
  people: Person[];
  reminders: Reminder[];
  settings: AccountSettings;
};

export type PeopleData = {
  people: Person[];
  reminderDefaults: AccountSettings["reminderDefaults"];
  classes: PersonClass[];
};

export async function loadToday(userId: string): Promise<TodayData> {
  const [people, reminders, settings] = await Promise.all([
    getPeople(),
    getReminders(),
    getAccountSettings(userId),
  ]);
  return { people, reminders, settings };
}

export async function loadPeopleTab(userId: string): Promise<PeopleData> {
  const [people, settings, classes] = await Promise.all([
    getPeople(),
    getAccountSettings(userId),
    getClasses(userId),
  ]);
  return { people, reminderDefaults: settings.reminderDefaults, classes };
}

export async function loadTodayCached(userId: string): Promise<TodayData | null> {
  const [people, reminders, settings] = await Promise.all([
    getPeopleCached(),
    getRemindersCached(),
    getAccountSettingsCached(userId),
  ]);
  // Reminders being empty is a real state; people and settings missing means
  // this phone has never held a snapshot, and there is nothing to draw.
  if (!people || !settings) return null;
  return { people, reminders: reminders ?? [], settings };
}

export async function loadPeopleTabCached(
  userId: string,
): Promise<PeopleData | null> {
  const [people, settings] = await Promise.all([
    getPeopleCached(),
    getAccountSettingsCached(userId),
  ]);
  if (!people || !settings) return null;
  // Classes are not in the offline snapshot, and `getClasses` answers with an
  // empty list when it cannot reach the table, so an empty one here is the same
  // answer the app gives offline rather than an invented value. The refresh
  // that follows fills the filter in.
  return { people, reminderDefaults: settings.reminderDefaults, classes: [] };
}

/** Long enough that returning to the app does not refetch what it just had. */
const alreadyFreshMs = 15_000;

function warm<T>(key: string, loader: () => Promise<T>) {
  if (Date.now() - (queryUpdatedAt(key) ?? 0) < alreadyFreshMs) return;
  // Nothing awaits this and no screen is showing yet, so a failure here is not
  // an error state — whichever screen opens next will ask again and report it.
  void loadQuery(key, loader).catch(() => {});
}

/**
 * Starts the tabs' requests as soon as the app knows who is signed in, rather
 * than when a tab is first opened. By the time anything is tapped the answer is
 * usually already in the cache, and the screen paints instead of spinning.
 */
export function prefetchScreenData(userId: string) {
  warm(todayQueryKey, () => loadToday(userId));
  warm(peopleTabQueryKey, () => loadPeopleTab(userId));
  // The key the birthdays and map screens read.
  warm("people", () => getPeople());
}
