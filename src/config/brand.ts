export const brand = {
  name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "siyi.app",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || "siyi",
  slug: process.env.NEXT_PUBLIC_APP_SLUG?.trim() || "siyi-app",
  description: "Remember the people who make this chapter feel like yours.",
  sidebarTagline: "Your people, remembered",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@siyi.app",
  operatorName:
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "siyi.app",
  legalEffectiveDate: "August 4, 2026",
  postalAddress:
    "Clark Kerr Campus Building 7, 2601 Warring Street, Berkeley, CA 94720, care of Tarun Yadgirkar",
} as const;
