import type { Person, RelationshipStrength } from "@/lib/types";

export const relationshipTierLabels: Record<RelationshipStrength, string> = {
  1: "Acquaintance",
  2: "Getting to know",
  3: "Close",
  4: "Very close",
};

export const maxRelationshipLabelLength = 40;

export function relationshipLabelFor(
  person: Pick<Person, "relationshipStrength" | "relationshipLabel">,
): string {
  const custom = person.relationshipLabel?.trim();
  return custom || relationshipTierLabels[person.relationshipStrength];
}

export function isDefaultRelationshipLabel(label: string): boolean {
  return Object.values(relationshipTierLabels).includes(label.trim());
}
