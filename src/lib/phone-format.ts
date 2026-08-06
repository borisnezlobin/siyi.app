/**
 * Formats as the person types, without fighting them: anything that is not a
 * plain North American number is left exactly as entered, so international
 * numbers and extensions survive untouched.
 */
export function formatPhoneNumberInput(value: string) {
  const trimmed = value.trimStart();
  if (trimmed === "") return "";

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) {
    // A leading + means the person is writing a country code themselves.
    if (digits.startsWith("1") && digits.length <= 11) {
      return formatNorthAmerican(digits.slice(1), "+1 ");
    }
    return `+${digits}`;
  }

  if (digits.length > 10) return trimmed;
  return formatNorthAmerican(digits, "");
}

function formatNorthAmerican(digits: string, prefix: string) {
  if (digits.length === 0) return prefix.trimEnd();
  if (digits.length <= 3) return `${prefix}(${digits}`;
  if (digits.length <= 6) {
    return `${prefix}(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `${prefix}(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
