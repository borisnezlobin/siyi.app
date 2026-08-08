import type { PersonInput } from "@/lib/validation";
import type { Person } from "@/lib/types";

/**
 * A person as they are stored, in the shape a save wants.
 *
 * `updatePerson` writes every column it is given, so anything that saves one
 * field has to hand back the rest unchanged. Taking them from the person rather
 * than from a form is what stops a half-typed name being committed by a save
 * that was only meant to change a photo — or, now, by an update being filed.
 */
export function storedPersonInput(current: Person): PersonInput {
  return {
    fullName: current.fullName,
    preferredName: current.preferredName,
    instagramUsername: current.instagramUsername,
    phoneNumber: current.phoneNumber,
    email: current.email,
    birthday: current.birthday ?? "",
    hometown: current.hometown,
    dormOrResidence: current.dormOrResidence,
    university: current.university,
    major: current.major,
    graduationYear: current.graduationYear,
    relationshipStrength: current.relationshipStrength,
    relationshipLabel: current.relationshipLabel,
    remindersEnabled: current.remindersEnabled,
    reminderIntervalDays: current.reminderIntervalDays,
    status: current.status,
    firstMetAt: current.firstMetAt,
    firstMetLocation: current.firstMetLocation,
    generalNotes: current.generalNotes,
  };
}
