import { getNumberLocale } from "./hooks/locale.js";

type AmountSeparators = {
  decimal: string;
  group: string;
};

const CANONICAL_DECIMAL_SEPARATOR = ".";
const MAX_FRACTION_DIGITS = 20;

export function parseDisplayAmount(
  value: string,
  locale = getNumberLocale(),
): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const candidates = new Set<string>();
  for (const separators of [
    getAmountSeparators(locale),
    { decimal: ".", group: "," },
    { decimal: ",", group: "." },
  ]) {
    const parsed = parseWithSeparators(trimmed, separators);
    if (parsed != null) candidates.add(parsed);
  }
  // A pasted "1,234" could mean 1234 or 1.234. Do not guess with money.
  return candidates.size === 1 ? [...candidates][0] : null;
}

/** Existing grouping is display-only; newly typed comma/period is decimal. */
export function parseAmountEdit(
  value: string,
  previousValue: string,
  locale = getNumberLocale(),
): string {
  const previousDisplay = formatAmountInput(previousValue, locale);
  let start = 0;
  while (start < value.length && value[start] === previousDisplay[start]) {
    start++;
  }
  let end = value.length;
  let previousEnd = previousDisplay.length;
  while (
    end > start &&
    previousEnd > start &&
    value[end - 1] === previousDisplay[previousEnd - 1]
  ) {
    end--;
    previousEnd--;
  }
  const { decimal, group } = getAmountSeparators(locale);
  const parseExisting = (part: string) =>
    part.replaceAll(group, "").replaceAll(decimal, ".");
  return (
    parseExisting(value.slice(0, start)) +
    value.slice(start, end).replaceAll(",", ".") +
    parseExisting(value.slice(end))
  );
}

export function isValidAmountInput(
  value: string,
  maxDecimals: number,
): boolean {
  const fractionDigits = normalizeFractionDigits(maxDecimals);
  const regex = new RegExp(`^\\d*\\.?\\d{0,${fractionDigits}}$`);
  return value === "" || regex.test(value);
}

export function formatAmountInput(
  value: string,
  locale = getNumberLocale(),
): string {
  if (value === "") return "";
  if (countOccurrences(value, CANONICAL_DECIMAL_SEPARATOR) > 1) return value;

  const [integer = "", decimal] = value.split(CANONICAL_DECIMAL_SEPARATOR);
  if (!/^\d*$/.test(integer) || (decimal != null && !/^\d*$/.test(decimal))) {
    return value;
  }

  const separators = getAmountSeparators(locale);
  const groupedInteger =
    separators.group === ""
      ? integer
      : integer.replace(/\B(?=(\d{3})+(?!\d))/g, separators.group);
  if (decimal == null) return groupedInteger;
  return `${groupedInteger}${separators.decimal}${decimal}`;
}

export function formatFixedAmount(value: number, fractionDigits = 2): string {
  const normalizedFractionDigits = normalizeFractionDigits(fractionDigits);
  return new Intl.NumberFormat(getNumberLocale(), {
    minimumFractionDigits: normalizedFractionDigits,
    maximumFractionDigits: normalizedFractionDigits,
  }).format(value);
}

export function normalizeFractionDigits(fractionDigits: number): number {
  if (!Number.isFinite(fractionDigits)) return 2;
  return Math.min(MAX_FRACTION_DIGITS, Math.max(0, Math.trunc(fractionDigits)));
}

function getAmountSeparators(locale: string): AmountSeparators {
  const parts = new Intl.NumberFormat(locale).formatToParts(1000.1);
  return {
    decimal:
      parts.find((part) => part.type === "decimal")?.value ??
      CANONICAL_DECIMAL_SEPARATOR,
    group: parts.find((part) => part.type === "group")?.value ?? "",
  };
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

function parseWithSeparators(
  value: string,
  { decimal, group }: AmountSeparators,
): string | null {
  const parts = value.split(decimal);
  if (parts.length > 2) return null;
  const [integer, fraction] = parts;
  if (fraction != null && !/^\d*$/.test(fraction)) return null;

  const groups = group ? integer.split(group) : [integer];
  if (groups.length > 1) {
    if (!/^\d{1,3}$/.test(groups[0])) return null;
    if (groups.slice(1).some((part) => !/^\d{3}$/.test(part))) return null;
  } else if (!/^\d*$/.test(integer)) {
    return null;
  }
  return groups.join("") + (fraction == null ? "" : `.${fraction}`);
}
