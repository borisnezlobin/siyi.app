import type { Person } from "@/lib/types";

function dailyTieBreaker(personId: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const text = `${day}:${personId}`;
  let score = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    score ^= text.charCodeAt(index);
    score = Math.imul(score, 16777619);
  }
  return score >>> 0;
}

function contactAge(person: Person) {
  return new Date(person.lastInteractionAt || person.firstMetAt).getTime();
}

export function chooseCatchUpPerson(people: Person[], now = new Date()) {
  const activePeople = people.filter((person) => person.status === "active");
  const notJustMet = activePeople.filter(
    (person) =>
      now.getTime() - new Date(person.firstMetAt).getTime() >
      24 * 60 * 60 * 1000,
  );
  const candidates = notJustMet.length > 0 ? notJustMet : activePeople;

  return [...candidates].sort((left, right) => {
    const ageDifference = contactAge(left) - contactAge(right);
    if (ageDifference !== 0) return ageDifference;
    return (
      dailyTieBreaker(left.id, now) - dailyTieBreaker(right.id, now)
    );
  })[0];
}

function shortContext(value: string) {
  const firstLine = value.split(/\n|[.!?]\s/)[0]?.trim() || "";
  return firstLine.length > 72
    ? `${firstLine.slice(0, 69).trimEnd()}…`
    : firstLine;
}

export function fallbackConversationStarters(person: Person) {
  const name = person.preferredName || person.fullName.split(" ")[0] || "them";
  const starters: string[] = [];

  if (person.generalNotes) {
    const context = shortContext(person.generalNotes);
    if (context) starters.push(`Follow up on “${context}”`);
  }
  if (person.major) {
    starters.push(`Ask how ${person.major} is going lately`);
  }
  if (person.firstMetLocation) {
    starters.push(`Bring up ${person.firstMetLocation}`);
  }
  if (person.hometown) {
    starters.push(`Ask what ${name} misses about ${person.hometown}`);
  }
  starters.push(`Ask what ${name} has been excited about recently`);

  return Array.from(new Set(starters)).slice(0, 3);
}
