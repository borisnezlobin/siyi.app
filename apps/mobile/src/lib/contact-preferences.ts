import AsyncStorage from "@react-native-async-storage/async-storage";
import { brand } from "@/config/brand";
import type { ContactMethod } from "@/lib/contact-links";

const contactMethods = new Set<ContactMethod>([
  "instagram",
  "messages",
  "mail",
  "discord",
]);

function preferenceKey(personId: string) {
  return `${brand.slug}.contact-method.${personId}`;
}

export async function getPreferredContactMethod(personId: string) {
  const stored = await AsyncStorage.getItem(preferenceKey(personId));
  return stored && contactMethods.has(stored as ContactMethod)
    ? (stored as ContactMethod)
    : null;
}

export async function setPreferredContactMethod(
  personId: string,
  method: ContactMethod,
) {
  await AsyncStorage.setItem(preferenceKey(personId), method);
}
