/**
 * Resend also carries the auth email, but that goes out over SMTP configured in
 * Supabase. Anything the app itself sends comes through here.
 */

const endpoint = "https://api.resend.com/emails";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Mail clients show their own unsubscribe control when these headers are
   * present, which keeps a tired reader from reaching for "report spam"
   * instead — and that is what protects the sending domain.
   */
  unsubscribeUrl?: string;
};

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function marketingSender() {
  return process.env.MARKETING_FROM_EMAIL?.trim() || "siyi <hello@siyi.app>";
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const headers: Record<string, string> = {};
  if (email.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${email.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: marketingSender(),
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected the send (${response.status}): ${detail}`);
  }
}
