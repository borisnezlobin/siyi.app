import { Platform } from "react-native";
import { brand } from "@/config/brand";
import { chooseCatchUpPerson } from "@/lib/catch-up";
import { relativeDayLabel } from "@/lib/date-labels";
import {
  daysUntilBirthday,
  overdueDays,
} from "@/lib/reminders";
import type {
  FollowUp,
  Person,
  ReminderDefaults,
} from "@/lib/types";

type HomeWidgetData = {
  people: Person[];
  followUps: FollowUp[];
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
  followUps,
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
        import("../../widgets/FrenkTodayWidget"),
        import("../../widgets/FrenkCatchUpWidget"),
      ]);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 14);
    const openFollowUps = followUps.filter((followUp) => !followUp.completedAt);
    const overdueFollowUps = openFollowUps.filter(
      (followUp) => new Date(followUp.dueAt) < now,
    );
    const upcomingFollowUps = openFollowUps.filter((followUp) => {
      const dueAt = new Date(followUp.dueAt);
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
    const nextFollowUp = overdueFollowUps[0] || upcomingFollowUps[0];
    const nextBirthday = birthdays[0];
    const nextTitle = nextFollowUp
      ? nextFollowUp.text
      : nextBirthday
        ? `${nextBirthday.preferredName || nextBirthday.fullName}’s birthday`
        : "No reminders waiting";
    const nextDetail = nextFollowUp
      ? relativeDayLabel(nextFollowUp.dueAt)
      : nextBirthday
        ? `${daysUntilBirthday(nextBirthday.birthday, now)} days away`
        : `Open ${brand.name} to catch up with someone`;

    todayWidget.updateSnapshot({
      appName: brand.name,
      needAttention: overdueFollowUps.length + overduePeople.length,
      comingUp: upcomingFollowUps.length + birthdays.length,
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
