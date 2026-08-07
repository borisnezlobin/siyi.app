import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("terms");

const sections = [
  {
    title: "Using the service",
    paragraphs: [
      `You may use ${brand.name} if you can legally enter into these Terms. You must provide accurate account information, protect access to your account, and promptly tell us if you believe it has been compromised.`,
      "You are responsible for your internet access, device, and any carrier or data charges. We may change or discontinue features as the service evolves, but we will not intentionally prevent you from exporting your data before a planned shutdown when it is reasonably possible to provide notice.",
    ],
  },
  {
    title: "Information about other people",
    paragraphs: [
      "The service lets you save personal details about people you know. Only save information you obtained lawfully and have an appropriate reason to keep. Respect requests to correct or remove someone’s information, and do not use the service to build dossiers, monitor people, or store highly sensitive information that is unnecessary for staying in touch.",
      "You retain ownership of content you add. You give us a limited permission to host, process, copy, and transmit that content only as needed to operate, secure, and improve the service for you.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Do not use the service to harass, stalk, threaten, impersonate, discriminate against, or harm anyone; violate privacy, intellectual-property, or other rights; upload malicious code; probe or bypass security; scrape the service; send spam; or use another person’s account without permission.",
      "We may limit or suspend access when reasonably necessary to protect users, third parties, or the service, investigate misuse, or comply with law.",
    ],
  },
  {
    title: "Third-party services",
    paragraphs: [
      "Authentication, hosting, storage, and notifications rely on third-party providers such as Supabase, Vercel, Expo, Apple, and Google. Their services may have separate terms. We are not responsible for third-party products that you choose to use, but we remain responsible for selecting and configuring our processors with reasonable care.",
    ],
  },
  {
    title: "Notifications and communications",
    paragraphs: [
      "Push notifications are optional. You control their categories and timing in the app and can revoke permission in your browser or device settings. Delivery timing is not guaranteed because it depends on operating systems, browsers, networks, and push providers.",
      "We may send essential account, security, legal, and service messages even when reminder notifications are off.",
    ],
  },
  {
    title: "Account deletion",
    paragraphs: [
      "You can export your data and delete your account from Settings. Deletion removes your authentication identity, owned database content, and uploaded photos, subject to limited retention in backups, security records, or records required by law. Account deletion is permanent.",
    ],
  },
  {
    title: "Service availability",
    paragraphs: [
      `We work to keep ${brand.name} reliable and secure, but the service is provided “as is” and “as available.” To the extent allowed by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee uninterrupted access, perfect reminders, or preservation of data outside our documented backup and export controls.`,
      "Nothing in these Terms limits consumer rights or liability that cannot legally be excluded.",
    ],
  },
  {
    title: "Limitation of liability",
    paragraphs: [
      `To the extent allowed by law, ${brand.operatorName} will not be liable for indirect, incidental, special, consequential, or punitive damages, lost profits, or lost opportunities arising from the service. Any aggregate liability for claims relating to the service will not exceed the greater of the amount you paid us in the twelve months before the claim or 100 US dollars.`,
      "These limitations do not apply where prohibited by law or to liability that cannot legally be limited.",
    ],
  },
  {
    title: "Changes and ending these Terms",
    paragraphs: [
      "We may update these Terms to reflect product, legal, or security changes. We will post the effective date and give additional notice for material changes when appropriate. Continuing to use the service after updated Terms take effect means you accept them.",
      "You may end these Terms by deleting your account. Provisions that logically need to continue—such as ownership, disclaimers, liability limits, and dispute provisions—survive account deletion.",
    ],
  },
  {
    title: "Law and contact",
    paragraphs: [
      "The laws that apply where the service operator is established govern these Terms, without overriding mandatory consumer protections that apply where you live. Before filing a formal claim, please contact us and give us a reasonable opportunity to resolve the issue informally.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-porcelain px-5 py-10 text-ink sm:py-16">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-semibold text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          Back to {brand.name}
        </Link>
        <header className="mt-8 rounded-[2rem] bg-white p-6 shadow-float sm:p-10">
          <p className="text-xs font-semibold text-coral-strong">
            Effective {brand.legalEffectiveDate}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
            Terms of service
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-ink-muted">
            These Terms are an agreement between you and {brand.operatorName}{" "}
            for using {brand.name}. Please read them before creating an
            account.
          </p>
        </header>

        <div className="mt-5 space-y-3">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[1.5rem] bg-white p-5 shadow-card sm:p-7"
            >
              <h2 className="font-display text-2xl">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-ink-muted">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
          <section className="rounded-[1.5rem] bg-sage p-5 text-sage-strong sm:p-7">
            <h2 className="font-display text-2xl">Questions?</h2>
            <p className="mt-3 text-sm leading-7">
              Contact{" "}
              <a
                href={`mailto:${brand.supportEmail}`}
                className="font-semibold underline"
              >
                {brand.supportEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
