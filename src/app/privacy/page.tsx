import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("privacy");

const sections = [
  {
    title: "Information you give us",
    content: (
      <>
        <p>
          Account information includes your email address, display name,
          authentication provider, profile photo, timezone, locale, and
          notification preferences.
        </p>
        <p>
          Content you choose to save may include names, contact details,
          birthdays, photos, social usernames, education details, notes,
          interactions, tags, and reminders about people you know. You decide
          what to add and are responsible for having an appropriate reason to
          store it.
        </p>
      </>
    ),
  },
  {
    title: "Device and technical information",
    content: (
      <p>
        We process session cookies or secure device tokens to keep you signed
        in. If you enable notifications, we store a browser or device push
        token, notification settings, delivery status, device platform, and
        basic user-agent information. We may also process IP address and
        request logs for security, reliability, and abuse prevention. We do
        not use advertising trackers.
      </p>
    ),
  },
  {
    title: "Your device address book",
    content: (
      <p>
        The iPhone app can ask for access to your contacts, and never does so
        before you have saved someone. It is used on the device to recognise a
        person you have saved as somebody already in your address book, and to
        add a person to your contacts when you ask for that. Your address book
        is not uploaded to us, and declining leaves every part of the app
        working.
      </p>
    ),
  },
  {
    title: "The card you choose to share",
    content: (
      <p>
        Your own card can be published at an unlisted link so people you meet
        can save you. A new account starts with one carrying your full name and
        major. You choose which of your details appear on it, and switching the
        link off stops the page resolving. These pages ask search engines not
        to index them. Nothing about the people you save is published this way.
      </p>
    ),
  },
  {
    title: "How we use information",
    content: (
      <ul>
        <li>Provide, synchronize, and secure your account.</li>
        <li>Show your people, updates, reminders, and reminders.</li>
        <li>Send notifications only for the categories you enable.</li>
        <li>Respond to support requests and investigate technical problems.</li>
        <li>Prevent fraud, misuse, and unauthorized access.</li>
        <li>Meet legal obligations and enforce our terms.</li>
      </ul>
    ),
  },
  {
    title: "When information is shared",
    content: (
      <>
        <p>
          We use service providers only to operate {brand.name}: Supabase for
          authentication, database, and file storage; Vercel for the web
          application; Expo, Apple Push Notification service, and Firebase
          Cloud Messaging for mobile notifications; and Apple or Google when
          you choose their sign-in option. These providers process information
          under their own terms and privacy commitments.
        </p>
        <p>
          We may disclose information when required by law, to protect people
          or the service, or as part of a merger, acquisition, financing, or
          sale where the recipient agrees to protect it. We do not sell
          personal information or share it for cross-context behavioral
          advertising.
        </p>
      </>
    ),
  },
  {
    title: "Storage, security, and retention",
    content: (
      <>
        <p>
          Your database rows are protected by account-level access policies.
          Uploaded photos are stored privately and displayed using short-lived
          signed links. Data is encrypted in transit, and service providers
          apply encryption and access controls to stored data.
        </p>
        <p>
          We keep account content while your account is active. Revoked push
          tokens and notification delivery records may be retained for a
          limited period for security and delivery troubleshooting. When you
          delete your account, we delete your authentication identity, owned
          database rows, and uploaded photos. Limited backups or legal records
          may persist temporarily where required for disaster recovery, fraud
          prevention, or law.
        </p>
      </>
    ),
  },
  {
    title: "Your choices and rights",
    content: (
      <>
        <p>
          You can correct information in the app, disable notification
          categories, revoke notification permission in your device or
          browser, export your data as JSON or CSV, and delete your account
          from Settings.
        </p>
        <p>
          Depending on where you live, you may also have rights to access,
          correct, delete, restrict, object to, or receive a copy of personal
          information, and to withdraw consent. Contact us to exercise a right.
          We may need to verify your identity before responding.
        </p>
      </>
    ),
  },
  {
    title: "International processing",
    content: (
      <p>
        Our providers may process information in countries other than your
        own. Where required, we rely on contractual and legal safeguards for
        international transfers.
      </p>
    ),
  },
  {
    title: "Children",
    content: (
      <p>
        {brand.name} is not directed to children under 13, and we do not
        knowingly collect their account information. If local law requires a
        higher age to consent to online services, you must meet that age or
        have valid permission from a parent or guardian.
      </p>
    ),
  },
  {
    title: "Changes and contact",
    content: (
      <p>
        We may update this policy as the service changes. We will post the new
        effective date and provide additional notice when a change materially
        affects your rights. Questions and privacy requests can be sent to{" "}
        <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-porcelain px-5 py-10 text-ink sm:py-16">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-semibold text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          Back to {brand.name}
        </Link>
        <header className="mt-8 rounded-[2rem] bg-ink p-6 text-white shadow-float sm:p-10">
          <p className="text-xs font-semibold text-sun">
            Effective {brand.legalEffectiveDate}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
            Privacy policy
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/68">
            {brand.name} is a private place for remembering people you know.
            This policy explains what {brand.operatorName} processes and the
            controls you have.
          </p>
        </header>

        <div className="mt-5 space-y-3">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.5rem] bg-white p-5 shadow-card sm:p-7"
            >
              <h2 className="font-display text-2xl">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-ink-muted [&_a]:font-semibold [&_a]:text-coral-strong [&_li]:ml-5 [&_li]:list-disc">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
