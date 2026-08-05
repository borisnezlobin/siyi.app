import { getTimeZones } from "@vvo/tzdb";

export type FriendlyTimezoneOption = {
  label: string;
  value: string;
};

function labelForTimezone(
  timezone: ReturnType<typeof getTimeZones>[number],
) {
  return `${timezone.alternativeName} — ${[
    timezone.mainCities.slice(0, 2).join(", "),
    timezone.countryName,
  ]
    .filter(Boolean)
    .join(" · ")}`;
}

export function friendlyTimezoneOptions(
  selectedTimezone?: string,
): FriendlyTimezoneOption[] {
  const timezones = getTimeZones({ includeUtc: true });
  const options = timezones.map((timezone) => ({
    label: labelForTimezone(timezone),
    value: timezone.name,
  }));
  if (
    selectedTimezone &&
    !options.some(({ value }) => value === selectedTimezone)
  ) {
    const selected = timezones.find(({ group }) =>
      group.includes(selectedTimezone),
    );
    options.unshift({
      label: selected
        ? labelForTimezone(selected)
        : selectedTimezone.replaceAll("_", " ").replace("/", " — "),
      value: selectedTimezone,
    });
  }
  return options;
}
