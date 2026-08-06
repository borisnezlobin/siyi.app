import ContextIntelligence from "../../modules/context-intelligence/src/ContextIntelligenceModule";
import type { Person } from "@/lib/types";

function personContext(person: Person) {
  return [
    `Name: ${person.preferredName || person.fullName}`,
    person.university ? `University: ${person.university}` : null,
    person.major ? `Major: ${person.major}` : null,
    person.hometown ? `Hometown: ${person.hometown}` : null,
    person.dormOrResidence
      ? `Residence: ${person.dormOrResidence}`
      : null,
    person.firstMetLocation
      ? `Where we met: ${person.firstMetLocation}`
      : null,
    person.generalNotes ? `Saved notes: ${person.generalNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * A bio is written for someone outside Siyi, so private notes never reach the
 * model at all. The prompt's own rules are the second line of defence, not the
 * first.
 */
function shareableContext(person: Person) {
  return [
    `Name: ${person.preferredName || person.fullName}`,
    person.university ? `Studies at: ${person.university}` : null,
    person.major ? `Studies: ${person.major}` : null,
    person.graduationYear ? `Class of: ${person.graduationYear}` : null,
    person.hometown ? `From: ${person.hometown}` : null,
    person.firstMetLocation ? `Met at: ${person.firstMetLocation}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function onDeviceShortBio(person: Person) {
  if (
    !ContextIntelligence ||
    ContextIntelligence.availability() !== "available"
  ) {
    return null;
  }

  try {
    const bio = (await ContextIntelligence.shortBio(shareableContext(person)))
      .trim();
    return bio || null;
  } catch {
    return null;
  }
}

export async function onDeviceConversationStarters(person: Person) {
  if (
    !ContextIntelligence ||
    ContextIntelligence.availability() !== "available"
  ) {
    return [];
  }

  try {
    return (
      await ContextIntelligence.conversationStarters(personContext(person))
    )
      .map((starter) => starter.trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
}
