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

/**
 * How well a zone answers a search, highest first.
 *
 * Somebody typing "pacific time" means Los Angeles, not Pacific/Apia — so the
 * name a zone is known by counts for more than the word appearing somewhere in
 * its identifier.
 */
export function timezoneMatchRank(timezone: FriendlyTimezone, query: string) {
  if (!query) return 0;
  const lower = (value: string) => value.toLowerCase();
  const alternative = lower(timezone.alternativeName ?? "");
  const abbreviation = lower(timezone.abbreviation ?? "");
  const cities = timezone.mainCities.map(lower);

  if (alternative === query || abbreviation === query) return 5;
  if (alternative.startsWith(query)) return 4;
  if (cities.some((city) => city === query)) return 3;
  if (cities.some((city) => city.startsWith(query))) return 2;
  if (alternative.includes(query)) return 1;
  return 0;
}
