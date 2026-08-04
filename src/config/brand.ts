export const brand = {
  name: "Frenk",
  shortName: "Frenk",
  slug: "frenk",
  description: "Remember the people who make this chapter feel like yours.",
  sidebarTagline: "Your people, remembered",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@frenk.app",
  operatorName:
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "Frenk",
  legalEffectiveDate: "August 4, 2026",
} as const;
