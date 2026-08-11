import { describe, expect, it } from "vitest";
import {
  orderReminderPeople,
  reminderNotificationBody,
  reminderPeopleLabel,
  type ReminderPerson,
} from "@/lib/reminder-people";

const person = (id: string, fullName: string, preferredName?: string): ReminderPerson => ({
  id,
  fullName,
  preferredName: preferredName ?? null,
  profilePhotoUrl: null,
});

const amelia = person("1", "Amelia Chen", "Amelia");
const luis = person("2", "Luis Ortega", "Luis");
const amara = person("3", "Amara Okafor");
const jonah = person("4", "Jonah Reed");

describe("who a reminder is about, in words", () => {
  it("names one person plainly", () => {
    expect(reminderPeopleLabel([amelia])).toBe("Amelia");
  });

  it("joins two with and, never a comma", () => {
    expect(reminderPeopleLabel([amelia, luis])).toBe("Amelia and Luis");
  });

  it("names two and counts the rest", () => {
    expect(reminderPeopleLabel([amelia, luis, amara])).toBe(
      "Amelia, Luis and 1 other",
    );
    expect(reminderPeopleLabel([amelia, luis, amara, jonah])).toBe(
      "Amelia, Luis and 2 others",
    );
  });

  it("uses the name the owner calls them, not the full one", () => {
    expect(reminderPeopleLabel([amelia])).toBe("Amelia");
    expect(reminderPeopleLabel([amara])).toBe("Amara Okafor");
  });

  it("says nothing about nobody", () => {
    expect(reminderPeopleLabel([])).toBe("");
  });
});

describe("the notification body", () => {
  it("leads with the reminder and follows with who", () => {
    expect(reminderNotificationBody("Feed her cat", [amelia, luis])).toBe(
      "Feed her cat — Amelia and Luis",
    );
  });

  it("is just the reminder when there is nobody left to name", () => {
    // A reminder with no people should not exist — the last person leaving
    // deletes it — but a half-read row must not print a dangling dash.
    expect(reminderNotificationBody("Feed her cat", [])).toBe("Feed her cat");
  });
});

describe("which two get named", () => {
  it("does not change with the order the rows arrived in", () => {
    const one = orderReminderPeople([jonah, amelia, luis]);
    const two = orderReminderPeople([luis, jonah, amelia]);
    expect(one.map((p) => p.id)).toEqual(two.map((p) => p.id));
    expect(reminderPeopleLabel(one)).toBe(reminderPeopleLabel(two));
  });
});
