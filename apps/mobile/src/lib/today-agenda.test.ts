import {
  agendaCounts,
  agendaStatusFor,
  buildTodayAgenda,
  pickCheckInSuggestions,
  recentlyMetPeople,
} from "@/lib/today-agenda";

const today = new Date(2026, 4, 10, 9, 0, 0);

function daysAgo(days: number) {
  return new Date(today.getTime() - days * 86_400_000).toISOString();
}

const emptyInput = { reminders: [], overdueCheckIns: [], birthdays: [] };

describe("agendaStatusFor", () => {
  it("splits late, today and later", () => {
    expect(agendaStatusFor(-1)).toBe("overdue");
    expect(agendaStatusFor(0)).toBe("today");
    expect(agendaStatusFor(3)).toBe("upcoming");
  });
});

describe("buildTodayAgenda", () => {
  it("puts the latest thing first and the furthest away last", () => {
    const agenda = buildTodayAgenda({
      reminders: [
        {
          id: "r1",
          personIds: ["p1"],
          text: "Send the photos",
          personName: "Amelia",
          daysAway: 2,
        },
      ],
      overdueCheckIns: [{ personId: "p2", name: "Luis", daysOverdue: 5 }],
      birthdays: [
        { personId: "p3", name: "Nia", daysAway: 0, turningAge: 21 },
      ],
    });

    expect(agenda.map((item) => item.key)).toEqual([
      "check-in-p2",
      "birthday-p3",
      "reminder-r1",
    ]);
  });

  it("drops anything further out than two weeks", () => {
    const agenda = buildTodayAgenda({
      ...emptyInput,
      reminders: [
        {
          id: "r1",
          personIds: ["p1"],
          text: "Far off",
          personName: "Amelia",
          daysAway: 15,
        },
        {
          id: "r2",
          personIds: ["p1"],
          text: "Just inside",
          personName: "Amelia",
          daysAway: 14,
        },
      ],
    });

    expect(agenda.map((item) => item.title)).toEqual(["Just inside"]);
  });

  it("ignores a check-in that is not actually late", () => {
    expect(
      buildTodayAgenda({
        ...emptyInput,
        overdueCheckIns: [{ personId: "p1", name: "Amelia", daysOverdue: 0 }],
      }),
    ).toEqual([]);
  });

  it("reads the person and the due date on one line", () => {
    const [item] = buildTodayAgenda({
      ...emptyInput,
      reminders: [
        {
          id: "r1",
          personIds: ["p1"],
          text: "Send the photos",
          personName: "Amelia",
          daysAway: 0,
        },
      ],
    }, today);

    expect(item.detail).toBe("Amelia · Due today");
    expect(item.reminderId).toBe("r1");
  });

  it("names the day a countdown does not", () => {
    const [item] = buildTodayAgenda(
      {
        ...emptyInput,
        reminders: [
          {
            id: "r1",
            personIds: ["p1"],
            text: "Send the photos",
            personName: "Amelia",
            daysAway: 4,
          },
        ],
      },
      today,
    );

    expect(item.detail).toBe("Amelia · Due in 4 days · May 14");
  });

  it("says turning, not turns, for a birthday with a known age", () => {
    const [withAge] = buildTodayAgenda({
      ...emptyInput,
      birthdays: [{ personId: "p1", name: "Nia", daysAway: 1, turningAge: 22 }],
    });
    const [withoutAge] = buildTodayAgenda({
      ...emptyInput,
      birthdays: [{ personId: "p2", name: "Sam", daysAway: 1, turningAge: null }],
    });

    expect(withAge.title).toBe("Nia’s birthday");
    expect(withAge.detail).toBe("Tomorrow · turning 22");
    expect(withoutAge.detail).toBe("Tomorrow");
  });
});

describe("agendaCounts", () => {
  it("counts overdue and due-today together, upcoming apart", () => {
    const agenda = buildTodayAgenda({
      reminders: [
        {
          id: "r1",
          personIds: ["p1"],
          text: "Today",
          personName: "Amelia",
          daysAway: 0,
        },
        {
          id: "r2",
          personIds: ["p1"],
          text: "Later",
          personName: "Amelia",
          daysAway: 4,
        },
      ],
      overdueCheckIns: [{ personId: "p2", name: "Luis", daysOverdue: 3 }],
      birthdays: [{ personId: "p3", name: "Nia", daysAway: 9, turningAge: null }],
    });

    expect(agendaCounts(agenda)).toEqual({ needAttention: 2, comingUp: 2 });
  });
});

describe("recentlyMetPeople", () => {
  const people = [
    { id: "a", status: "active", firstMetAt: daysAgo(1) },
    { id: "b", status: "active", firstMetAt: daysAgo(6) },
    { id: "c", status: "active", firstMetAt: daysAgo(30) },
    { id: "d", status: "archived", firstMetAt: daysAgo(2) },
  ];

  it("keeps the last seven days, newest first, and skips archived people", () => {
    expect(recentlyMetPeople(people, today).map((person) => person.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("stops at the limit", () => {
    expect(recentlyMetPeople(people, today, 1)).toHaveLength(1);
  });
});

describe("pickCheckInSuggestions", () => {
  const people = [
    {
      id: "a",
      status: "active",
      firstMetAt: daysAgo(90),
      lastInteractionAt: daysAgo(40),
    },
    {
      id: "b",
      status: "active",
      firstMetAt: daysAgo(90),
      lastInteractionAt: daysAgo(2),
    },
    {
      id: "c",
      status: "archived",
      firstMetAt: daysAgo(90),
      lastInteractionAt: daysAgo(400),
    },
  ];

  it("leads with whoever you have left longest", () => {
    expect(
      pickCheckInSuggestions(people, [], today).map((person) => person.id),
    ).toEqual(["a", "b"]);
  });

  it("leaves out anyone already named elsewhere on the screen", () => {
    expect(
      pickCheckInSuggestions(people, ["a"], today).map((person) => person.id),
    ).toEqual(["b"]);
  });

  it("never suggests an archived person", () => {
    expect(
      pickCheckInSuggestions(people, [], today).some(
        (person) => person.id === "c",
      ),
    ).toBe(false);
  });

  it("holds the same order all day and stops at the limit", () => {
    const morning = pickCheckInSuggestions(people, [], today, 1);
    const evening = pickCheckInSuggestions(
      people,
      [],
      new Date(2026, 4, 10, 22, 0, 0),
      1,
    );
    expect(morning.map((person) => person.id)).toEqual(
      evening.map((person) => person.id),
    );
    expect(morning).toHaveLength(1);
  });
});
