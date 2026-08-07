import { Platform } from "react-native";
import { brand } from "@/config/brand";
import { chooseCatchUpPerson } from "@/lib/catch-up";
import { dueDateLabel } from "@/lib/relative-time";
import {
  daysUntilBirthday,
  overdueDays,
} from "@/lib/reminders";
import type {
  Reminder,
  Person,
  ReminderDefaults,
} from "@/lib/types";

type HomeWidgetData = {
  people: Person[];
  reminders: Reminder[];
  reminderDefaults: ReminderDefaults;
};

function shortWidgetContext(person: Person) {
  if (person.generalNotes) {
    const firstLine = person.generalNotes.split(/\n|[.!?]\s/)[0]?.trim();
    if (firstLine) return firstLine;
  }
  if (person.major) return `Ask how ${person.major} is going`;
  if (person.firstMetLocation) {
    return `You met at ${person.firstMetLocation}`;
  }
  return "A good person to check in with today";
}

export async function refreshHomeWidgets({
  people,
  reminders,
  reminderDefaults,
}: HomeWidgetData) {
  if (
    Platform.OS !== "ios" ||
    !brand.iosProtectedCapabilitiesEnabled
  ) {
    return;
  }

  try {
    const [{ default: todayWidget }, { default: catchUpWidget }] =
      await Promise.all([
        import("../../widgets/SiyiTodayWidget"),
        import("../../widgets/SiyiCatchUpWidget"),
      ]);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 14);
    const openReminders = reminders.filter((reminder) => !reminder.completedAt);
    const overdueReminders = openReminders.filter(
      (reminder) => new Date(reminder.dueAt) < now,
    );
    const upcomingReminders = openReminders.filter((reminder) => {
      const dueAt = new Date(reminder.dueAt);
      return dueAt >= now && dueAt <= cutoff;
    });
    const activePeople = people.filter(
      (person) => person.status === "active",
    );
    const overduePeople = activePeople.filter(
      (person) => overdueDays(person, now, reminderDefaults) > 0,
    );
    const birthdays = activePeople
      .filter((person) => {
        const days = daysUntilBirthday(person.birthday, now);
        return days !== null && days <= 14;
      })
      .sort(
        (left, right) =>
          (daysUntilBirthday(left.birthday, now) || 0) -
          (daysUntilBirthday(right.birthday, now) || 0),
      );
    const nextReminder = overdueReminders[0] || upcomingReminders[0];
    const nextBirthday = birthdays[0];
    const nextTitle = nextReminder
      ? nextReminder.text
      : nextBirthday
        ? `${nextBirthday.preferredName || nextBirthday.fullName}’s birthday`
        : "No reminders waiting";
    const nextDetail = nextReminder
      ? dueDateLabel(nextReminder.dueAt, now)
      : nextBirthday
        ? `${daysUntilBirthday(nextBirthday.birthday, now)} days away`
        : `Open ${brand.name} to catch up with someone`;

    todayWidget.updateSnapshot({
      appName: brand.name,
      needAttention: overdueReminders.length + overduePeople.length,
      comingUp: upcomingReminders.length + birthdays.length,
      nextTitle,
      nextDetail,
      destination: `${brand.scheme}://today`,
    });

    const catchUpPerson = chooseCatchUpPerson(activePeople, now);
    catchUpWidget.updateSnapshot({
      name: catchUpPerson
        ? catchUpPerson.preferredName || catchUpPerson.fullName
        : "Add someone",
      context: catchUpPerson
        ? shortWidgetContext(catchUpPerson)
        : "Start remembering the people you meet",
      destination: catchUpPerson
        ? `${brand.scheme}://people/${catchUpPerson.id}?catchUp=1`
        : `${brand.scheme}://people/new`,
    });
  } catch {
    return;
  }
}
