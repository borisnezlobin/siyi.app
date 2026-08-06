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

export type Person = {
  id: string;
  userId: string;
  fullName: string;
  preferredName: string | null;
  profilePhotoUrl: string | null;
  instagramUsername: string | null;
  phoneNumber: string | null;
  email: string | null;
  birthday: string | null;
  hometown: string | null;
  dormOrResidence: string | null;
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
  lastInteractionAt?: string | null;
  tags?: Tag[];
};

export type Interaction = {
  id: string;
  personId: string;
  userId: string;
  type: InteractionType;
  occurredAt: string;
  note: string | null;
  customLabel: string | null;
  customIcon: string | null;
  sourceUpdateId: string | null;
  createdAt: string;
  updatedAt: string;
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

export type Tag = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};

export type FollowUp = {
  id: string;
  personId: string;
  userId: string;
  text: string;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  person?: Pick<Person, "id" | "fullName" | "preferredName" | "profilePhotoUrl">;
};

export type ReminderDefaults = Record<RelationshipStrength, number>;

export type NotificationPreference = {
  id: string;
  userId: string;
  pushEnabled: boolean;
  overdueContactEnabled: boolean;
  birthdayEnabled: boolean;
  followUpEnabled: boolean;
  reminderHourLocal: number;
  reminderDaysOfWeek: number[];
  createdAt: string;
  updatedAt: string;
};
