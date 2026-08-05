import ContextIntelligence from "../../modules/context-intelligence/src/ContextIntelligenceModule";
import type { Person } from "@/lib/types";

function personContext(person: Person) {
  return [
    `Name: ${person.preferredName || person.fullName}`,
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
