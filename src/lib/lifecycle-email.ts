import type { AdminUserFacts } from "@/lib/admin";

/**
 * Which nudge an account has earned, and what that nudge says. Nothing here
 * reads the database or sends anything, so every rule about who gets mailed is
 * decided in one testable place.
 */

const dayInMs = 24 * 60 * 60 * 1000;

export type LifecycleCampaign = {
  id: string;
  label: string;
  description: string;
  subject: string;
  paragraphs: string[];
  action: { label: string; path: string };
  matches: (facts: AdminUserFacts, now: Date) => boolean;
};

function daysSinceSignup(facts: AdminUserFacts, now: Date) {
  return (now.getTime() - new Date(facts.createdAt).getTime()) / dayInMs;
}

function daysSinceActive(facts: AdminUserFacts, now: Date) {
  if (!facts.lastActiveAt) return Number.POSITIVE_INFINITY;
  return (now.getTime() - new Date(facts.lastActiveAt).getTime()) / dayInMs;
}

/**
 * Order matters: the first campaign an account matches is the one it gets, so
 * someone who has been quiet and has no contacts hears about adding their first
 * person rather than about coming back to a directory that is empty.
 */
export const lifecycleCampaigns: LifecycleCampaign[] = [
  {
    id: "no-contacts-after-3-days",
    label: "No contacts yet",
    description: "Signed up three days ago and has not saved anyone.",
    subject: "Add the first person you want to remember",
    paragraphs: [
      "You signed up a few days ago and there is nobody in your directory yet — which means siyi has nothing to remind you about.",
      "Adding someone takes about ten seconds: a name is enough to start, and everything else can come later, whenever you learn it.",
    ],
    action: { label: "Add someone", path: "/people/new" },
    matches: (facts, now) =>
      facts.contactCount === 0 && daysSinceSignup(facts, now) >= 3,
  },
  {
    id: "quiet-for-30-days",
    label: "Quiet for a month",
    description: "Has contacts, but nothing saved or logged in 30 days.",
    subject: "Your people are still here",
    paragraphs: [
      "It has been about a month since you last added anyone or logged a conversation.",
      "Nothing needs catching up on — but if someone comes to mind, writing down what you remember now is what makes the next conversation easier.",
    ],
    action: { label: "Open siyi", path: "/today" },
    matches: (facts, now) =>
      facts.contactCount > 0 && daysSinceActive(facts, now) >= 30,
  },
];

export function findLifecycleCampaign(campaignId: string) {
  return lifecycleCampaigns.find((campaign) => campaign.id === campaignId) ?? null;
}

/**
 * An unverified address is never mailed: the person never proved it is theirs,
 * and a nudge to an address someone typed by mistake is mail to a stranger.
 */
export function campaignForUser(
  facts: AdminUserFacts,
  alreadySent: Iterable<string>,
  now: Date = new Date(),
): LifecycleCampaign | null {
  if (!facts.marketingOptIn) return null;
  if (!facts.emailConfirmedAt) return null;

  const sent = new Set(alreadySent);
  return (
    lifecycleCampaigns.find(
      (campaign) => !sent.has(campaign.id) && campaign.matches(facts, now),
    ) ?? null
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function renderLifecycleEmail({
  campaign,
  appUrl,
  unsubscribeUrl,
  brandName,
  postalAddress,
}: {
  campaign: LifecycleCampaign;
  appUrl: string;
  unsubscribeUrl: string;
  brandName: string;
  postalAddress: string;
}): RenderedEmail {
  const actionUrl = `${appUrl.replace(/\/$/, "")}${campaign.action.path}`;
  const paragraphs = campaign.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#3d3a37;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f7f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;">
<tr><td style="padding:32px;">
<p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#1c1a19;">${escapeHtml(brandName)}</p>
${paragraphs}
<a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:4px;padding:12px 22px;border-radius:14px;background:#e2725b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(campaign.action.label)}</a>
</td></tr>
<tr><td style="padding:0 32px 28px;">
<p style="margin:0;font-size:12px;line-height:19px;color:#8a827c;">
You are getting this because you asked to hear from us when you signed up.
<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a827c;">Unsubscribe</a> and we will stop.
<br />${escapeHtml(postalAddress)}
</p>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    ...campaign.paragraphs,
    `${campaign.action.label}: ${actionUrl}`,
    "",
    `You are getting this because you asked to hear from us when you signed up. Unsubscribe: ${unsubscribeUrl}`,
    postalAddress,
  ].join("\n\n");

  return { subject: campaign.subject, html, text };
}
