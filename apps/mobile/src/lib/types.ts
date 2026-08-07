import type { ContactMethodDraft } from "@/lib/contact-methods";

export const relationshipStrengths = [1, 2, 3, 4] as const;
export type RelationshipStrength = (typeof relationshipStrengths)[number];

export const personStatuses = ["active", "muted", "archived"] as const;
export type PersonStatus = (typeof personStatuses)[number];

export const interactionTypes = [
  "met",
  "texted",
  "called",
  "coffee",
  "meal",
  "party",
  "class",
  "event",
  "other",
] as const;
export type InteractionType = (typeof interactionTypes)[number];

export type UserProfile = {
  id: string;
  authUserId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};

export type Person = {
  id: string;
  /** Null until migration 0012 has been applied on the server. */
  slug: string | null;
  userId: string;
  fullName: string;
  preferredName: string | null;
  profilePhotoUrl: string | null;
  profilePhotoPath: string | null;
  /** The primary of each kind, still the only value older screens read. */
  instagramUsername: string | null;
  phoneNumber: string | null;
  email: string | null;
  /** Every phone, email and handle. Falls back to the three fields above until
   * migration 0013 has been applied on the server. */
  contactMethods?: ContactMethodDraft[];
  birthday: string | null;
  hometown: string | null;
  dormOrResidence: string | null;
  university: string | null;
  major: string | null;
  graduationYear: number | null;
  relationshipStrength: RelationshipStrength;
  relationshipLabel: string | null;
  remindersEnabled: boolean;
  reminderIntervalDays: number | null;
  status: PersonStatus;
  firstMetAt: string;
  firstMetLocation: string | null;
  generalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  lastInteractionAt: string | null;
  tags: Tag[];
};

export type Interaction = {
  id: string;
  personId: string;
  userId: string;
  type: InteractionType;
  occurredAt: string;
  note: string | null;
  /** The user's own words for an "Other" interaction. Null until migration
   * 0009 has been applied on the server. */
  customLabel: string | null;
  /** A key from the app's fixed icon set, never arbitrary text. */
  customIcon: string | null;
  createdAt: string;
  updatedAt: string;
  sourceUpdateId: string | null;
};

export type PersonUpdate = {
  id: string;
  userId: string;
  text: string;
  recordedAt: string;
  isInteraction: boolean;
  interactionLabel: string | null;
  createdAt: string;
  updatedAt: string;
  personIds: string[];
};

export type PersonNote = {
  id: string;
  personId: string;
  userId: string;
  heading: string;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

/** Empty and unavailable are different: the sections feature stays hidden
 * until migration 0010 has run. */
export type PersonNoteSections = {
  available: boolean;
  sections: PersonNote[];
};

export const unavailableNoteSections: PersonNoteSections = {
  available: false,
  sections: [],
};

export type Reminder = {
  id: string;
  personId: string;
  userId: string;
  text: string;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  person?: Pick<
    Person,
    | "id"
    | "fullName"
    | "preferredName"
    | "profilePhotoUrl"
    | "profilePhotoPath"
  >;
};

export type ReminderDefaults = Record<RelationshipStrength, number>;

export type NotificationPreference = {
  id: string;
  userId: string;
  pushEnabled: boolean;
  overdueContactEnabled: boolean;
  birthdayEnabled: boolean;
  reminderEnabled: boolean;
  reminderHourLocal: number;
  reminderDaysOfWeek: number[];
  createdAt: string;
  updatedAt: string;
};

export const defaultReminderIntervals: ReminderDefaults = {
  1: 90,
  2: 45,
  3: 30,
  4: 14,
};
