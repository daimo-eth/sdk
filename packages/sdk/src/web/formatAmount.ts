const GROUP_SEPARATOR = ",";
const DECIMAL_SEPARATOR = ".";
const VALID_GROUPED_INTEGER_REGEX = /^\d{1,3}(,\d{3})+$/;

export function parseDisplayAmount(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const dotCount = countOccurrences(trimmed, DECIMAL_SEPARATOR);
  if (dotCount > 1) return trimmed;

  if (dotCount === 1) {
    const [integer = "", decimal = ""] = trimmed.split(DECIMAL_SEPARATOR);
    if (integer.includes(GROUP_SEPARATOR)) {
      if (!VALID_GROUPED_INTEGER_REGEX.test(integer)) return trimmed;
      return `${integer.replaceAll(GROUP_SEPARATOR, "")}.${decimal}`;
    }
    return trimmed;
  }

  const commaCount = countOccurrences(trimmed, GROUP_SEPARATOR);
  if (commaCount === 0) return trimmed;

  if (VALID_GROUPED_INTEGER_REGEX.test(trimmed)) {
    return trimmed.replaceAll(GROUP_SEPARATOR, "");
  }

  if (commaCount === 1) {
    return trimmed.replace(GROUP_SEPARATOR, DECIMAL_SEPARATOR);
  }

  return trimmed;
}

export function isValidAmountInput(
  value: string,
  maxDecimals: number,
): boolean {
  const sanitized = parseDisplayAmount(value);
  const regex = new RegExp(`^\\d*\\.?\\d{0,${maxDecimals}}$`);
  return sanitized === "" || regex.test(sanitized);
}

export function formatAmountInput(value: string): string {
  const sanitized = parseDisplayAmount(value);
  if (sanitized === "") return "";

  const [integer = "", decimal] = sanitized.split(".");
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimal == null) return groupedInteger;
  return `${groupedInteger}.${decimal}`;
}

export function formatFixedAmount(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}
