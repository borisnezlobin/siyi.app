import type { Person } from "@/lib/types";

export type ContactMethod = "instagram" | "messages" | "mail" | "discord";

export type ContactChoice = {
  method: ContactMethod;
  label: string;
  detail: string;
};

/**
 * The same four choices the phone offers, in the same order. The labels differ
 * by one word on purpose: the phone can name the app it is about to open
 * ("Messages", "Mail"), and a browser cannot promise which one will answer.
 */
export function contactChoicesForPerson(
  person: Pick<Person, "instagramUsername" | "phoneNumber" | "email">,
): ContactChoice[] {
  const choices: ContactChoice[] = [];
  if (person.instagramUsername) {
    choices.push({
      method: "instagram",
      label: "Instagram",
      detail: `@${person.instagramUsername}`,
    });
  }
  if (person.phoneNumber) {
    choices.push({
      method: "messages",
      label: "Text",
      detail: person.phoneNumber,
    });
  }
  if (person.email) {
    choices.push({
      method: "mail",
      label: "Email",
      detail: person.email,
    });
  }
  choices.push({
    method: "discord",
    label: "Discord",
    detail: "Open direct messages",
  });
  return choices;
}

/**
 * There is no fallback pair here as there is on the phone. A browser cannot be
 * asked whether it can open `instagram://` and told to try something else, so
 * the web always takes the https route, which works everywhere and hands off
 * to the installed app by itself on a phone.
 */
export function contactHrefFor(
  person: Pick<Person, "instagramUsername" | "phoneNumber" | "email">,
  method: ContactMethod,
): string | null {
  if (method === "instagram" && person.instagramUsername) {
    return `https://instagram.com/${encodeURIComponent(person.instagramUsername)}`;
  }
  if (method === "messages" && person.phoneNumber) {
    return `sms:${person.phoneNumber}`;
  }
  if (method === "mail" && person.email) {
    return `mailto:${person.email}`;
  }
  if (method === "discord") {
    return "https://discord.com/app";
  }
  return null;
}
