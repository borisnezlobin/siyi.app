import { ArrowLeft } from "phosphor-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Screen } from "@/components/screen";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

const privacySections: LegalSection[] = [
  {
    title: "What we collect",
    paragraphs: [
      `${brand.name} stores the account details you provide, including your name, email address, timezone, locale, sign-in providers, and notification preferences.`,
      "When you use the app, we store the people, contact details, photos, notes, tags, updates, interactions, birthdays, and reminders you choose to add. We also receive limited device and diagnostic details needed for security, sign-in, push delivery, and reliable operation.",
    ],
  },
  {
    title: "Your device address book",
    paragraphs: [
      "The app can ask for access to your contacts, and never does so before you have saved someone. It is used on the device to recognise a person you have saved as somebody already in your address book, and to add a person to your contacts when you ask for that.",
      "Your address book is not uploaded to us, and declining leaves every part of the app working.",
    ],
  },
  {
    title: "The card you choose to share",
    paragraphs: [
      "Your own card can be published at an unlisted link so people you meet can save you. A new account starts with one carrying your full name and major. You choose which of your details appear on it, and switching the link off stops the page resolving.",
      "These pages ask search engines not to index them, and nothing about the people you save is published this way.",
    ],
  },
  {
    title: "How we use it",
    paragraphs: [
      "We use your information to provide the app, keep your data synchronized, calculate reminders in your timezone, send the notifications you enable, secure accounts, respond to support, and improve reliability.",
      "We do not sell personal information, serve targeted advertising, scrape social networks, or use contact records to build advertising profiles.",
    ],
  },
  {
    title: "Storage and service providers",
    paragraphs: [
      "Account and app data are processed with Supabase. The web service may run on Vercel. Mobile builds and push transport may involve Expo, Apple Push Notification service, and Firebase Cloud Messaging. Apple and Google process sign-in details when you choose those methods.",
      "Profile photos are held in private storage and delivered through short-lived signed links. Access controls are enforced in the database for every user-owned record.",
    ],
  },
  {
    title: "Sharing and your choices",
    paragraphs: [
      "We share information only with processors needed to run the service, when you direct us to, to protect users and the service, or when law requires it. Each processor receives only what it needs for its role.",
      "You can export your data, disable notifications, sign out, or permanently delete your account from Settings. Account deletion removes your owned app data and authentication identity, subject to short-lived security backups or legal retention obligations.",
    ],
  },
  {
    title: "Retention, security, and transfers",
    paragraphs: [
      "We retain account data while your account is active and remove it after a valid deletion request. Delivery and security records may be kept briefly to prevent duplicate messages, diagnose failures, and protect the service.",
      "We use encryption in transit, least-privilege access, private storage, and database row-level security. No system can guarantee absolute security. Providers may process data in countries other than yours, using the safeguards required by applicable law.",
    ],
  },
  {
    title: "Children and changes",
    paragraphs: [
      `${brand.name} is not directed to children under 13, and we do not knowingly collect their information. Additional minimum ages may apply where you live.`,
      "We may update this policy as the service changes. Material changes will be communicated in the app or by another reasonable method before they take effect.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      `Questions, access requests, corrections, or deletion requests can be sent to ${brand.supportEmail}. The service is operated by ${brand.operatorName}.`,
    ],
  },
];

const termsSections: LegalSection[] = [
  {
    title: "Your account",
    paragraphs: [
      `These Terms govern your use of ${brand.name}. You must provide accurate account information, use a sign-in method you control, and keep access to your account secure.`,
      "You are responsible for activity under your account. Tell us promptly if you believe someone else has gained access.",
    ],
  },
  {
    title: "Information about other people",
    paragraphs: [
      "The app helps you privately remember people and context. Add only information you have a lawful and respectful reason to store. You are responsible for complying with privacy, communications, and other laws that apply to the information you enter.",
      "Do not use the service to harass, stalk, discriminate, impersonate, expose sensitive information without permission, or create profiles for harmful purposes.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Do not attempt to break security controls, access another user’s data, overload the service, distribute malware, reverse engineer protected portions of the service, or use automated extraction that interferes with normal operation.",
      "You keep ownership of the content you add. You grant us a limited right to process it only as needed to operate, secure, and support the service.",
    ],
  },
  {
    title: "Third-party services and notifications",
    paragraphs: [
      "Sign-in, hosting, storage, delivery, and mobile distribution rely on third-party services. Their own terms may also apply. We do not control their availability.",
      "Reminders are a convenience, not a guaranteed alerting system. Delivery can be delayed or blocked by device settings, network conditions, operating systems, or providers. Do not rely on the app for emergencies or safety-critical obligations.",
    ],
  },
  {
    title: "Availability and changes",
    paragraphs: [
      "We may improve, change, suspend, or discontinue features. We aim to keep the service dependable but provide it on an as-available basis to the extent permitted by law.",
      "We may restrict accounts that materially violate these Terms or threaten the service or other people. You may stop using the service and delete your account at any time.",
    ],
  },
  {
    title: "Disclaimers and liability",
    paragraphs: [
      "To the fullest extent permitted by law, the service is provided without implied warranties, and we are not liable for indirect, incidental, special, consequential, or punitive damages, lost data, or lost profits arising from its use.",
      "Nothing in these Terms limits rights or liabilities that cannot legally be limited. Any aggregate liability is limited to the greater of amounts you paid us in the prior twelve months or 100 US dollars.",
    ],
  },
  {
    title: "Contact and updates",
    paragraphs: [
      `The service is operated by ${brand.operatorName}. Questions about these Terms can be sent to ${brand.supportEmail}.`,
      "We may update these Terms. If a change materially affects your rights, we will provide reasonable notice. Continued use after the effective date means you accept the revised Terms.",
    ],
  },
];

export default function LegalScreen() {
  const router = useRouter();
  const { document } = useLocalSearchParams<{ document: string }>();
  const privacy = document === "privacy";
  const title = privacy ? "Privacy Policy" : "Terms of Service";
  const sections = privacy ? privacySections : termsSections;

  return (
    <Screen bottomInset={48} maxContentWidth={760}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.back}
      >
        <ArrowLeft color={colors.ink} size={21} />
      </Pressable>
      <View style={styles.header}>
        <AppText variant="display">{title}</AppText>
        <AppText style={styles.muted}>
          Effective {brand.legalEffectiveDate}
        </AppText>
      </View>
      <View style={styles.intro}>
        <AppText>
          {privacy
            ? `This policy explains how ${brand.name} handles information when you use the app and website.`
            : `Please read these terms before using ${brand.name}. They are designed to keep the service useful, private, and respectful.`}
        </AppText>
      </View>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <AppText variant="heading">{section.title}</AppText>
          {section.paragraphs.map((paragraph) => (
            <AppText key={paragraph} style={styles.body}>
              {paragraph}
            </AppText>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  header: {
    gap: 5,
  },
  muted: {
    color: colors.inkMuted,
  },
  intro: {
    backgroundColor: colors.sage,
    borderRadius: radii.large,
    padding: 18,
  },
  section: {
    gap: 9,
  },
  body: {
    color: colors.inkMuted,
  },
});
