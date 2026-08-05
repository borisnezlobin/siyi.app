import { Linking, Platform } from "react-native";
import type { Person } from "@/lib/types";

export type ContactMethod = "instagram" | "messages" | "mail" | "discord";

export type ContactChoice = {
  method: ContactMethod;
  label: string;
  detail: string;
};

export function contactChoicesForPerson(person: Person): ContactChoice[] {
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
      label: Platform.OS === "ios" ? "Messages" : "Text",
      detail: person.phoneNumber,
    });
  }
  if (person.email) {
    choices.push({
      method: "mail",
      label: Platform.OS === "ios" ? "Mail" : "Email",
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

async function openWithFallback(primaryUrl: string, fallbackUrl: string) {
  try {
    await Linking.openURL(primaryUrl);
  } catch {
    await Linking.openURL(fallbackUrl);
  }
}

export async function openContactMethod(
  person: Person,
  method: ContactMethod,
) {
  if (method === "instagram" && person.instagramUsername) {
    const username = encodeURIComponent(person.instagramUsername);
    await openWithFallback(
      `instagram://user?username=${username}`,
      `https://instagram.com/${username}`,
    );
    return;
  }
  if (method === "messages" && person.phoneNumber) {
    await Linking.openURL(`sms:${person.phoneNumber}`);
    return;
  }
  if (method === "mail" && person.email) {
    await Linking.openURL(`mailto:${person.email}`);
    return;
  }
  if (method === "discord") {
    await openWithFallback("discord://", "https://discord.com/app");
  }
}
