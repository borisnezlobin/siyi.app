export const brand = {
  name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Siyi.app",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || "Siyi",
  slug: process.env.NEXT_PUBLIC_APP_SLUG?.trim() || "siyi-app",
  description: "Remember the people who make this chapter feel like yours.",
  sidebarTagline: "Your people, remembered",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@siyi.app",
  operatorName:
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "Siyi.app",
  legalEffectiveDate: "August 4, 2026",
} as const;
