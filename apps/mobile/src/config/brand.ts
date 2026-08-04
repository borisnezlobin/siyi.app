export const brand = {
  name: process.env.EXPO_PUBLIC_APP_NAME?.trim() || "Frenk",
  slug: process.env.EXPO_PUBLIC_APP_SLUG?.trim() || "frenk",
  scheme: process.env.EXPO_PUBLIC_APP_SCHEME?.trim() || "frenk",
  description: "Remember the people who make this chapter feel like yours.",
  webUrl: process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") || "",
  supportEmail:
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || "support@frenk.app",
  operatorName:
    process.env.EXPO_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "Frenk",
  legalEffectiveDate: "August 4, 2026",
  iosProtectedCapabilitiesEnabled:
    process.env.EXPO_PUBLIC_IOS_PROTECTED_CAPABILITIES !== "false",
} as const;
