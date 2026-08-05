import { getTimeZones } from "@vvo/tzdb";

export type FriendlyTimezone = ReturnType<typeof getTimeZones>[number];

const timezones = getTimeZones({ includeUtc: true }).sort(
  (left, right) =>
    left.currentTimeOffsetInMinutes - right.currentTimeOffsetInMinutes ||
    left.countryName.localeCompare(right.countryName) ||
    left.alternativeName.localeCompare(right.alternativeName),
);

export function friendlyTimezones() {
  return timezones;
}

export function timezoneOption(value: string) {
  return timezones.find(
    (timezone) =>
      timezone.name === value || timezone.group.includes(value),
  );
}

export function timezoneTitle(value: string) {
  const timezone = timezoneOption(value);
  if (!timezone) {
    return value.replaceAll("_", " ").split("/").at(-1) || value;
  }
  return timezone.alternativeName;
}

export function timezonePlace(value: string) {
  const timezone = timezoneOption(value);
  if (!timezone) return value.replaceAll("_", " ");
  const cities = timezone.mainCities.slice(0, 2).join(", ");
  return [cities, timezone.countryName].filter(Boolean).join(" · ");
}

export function timezoneOffset(value: string) {
  const timezone = timezoneOption(value);
  if (!timezone) return "";
  const minutes = timezone.currentTimeOffsetInMinutes;
  const sign = minutes >= 0 ? "+" : "−";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainingMinutes = absolute % 60;
  return `GMT${sign}${hours}${remainingMinutes ? `:${String(remainingMinutes).padStart(2, "0")}` : ""}`;
}

export function timezoneSearchText(timezone: FriendlyTimezone) {
  return [
    timezone.name,
    timezone.alternativeName,
    timezone.countryName,
    timezone.continentName,
    timezone.abbreviation,
    ...timezone.mainCities,
    ...timezone.group,
  ]
    .join(" ")
    .toLowerCase();
}
