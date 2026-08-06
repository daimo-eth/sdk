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
): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const separators = getAmountSeparators(locale);
  const ungrouped =
    separators.group === ""
      ? trimmed
      : trimmed.replaceAll(separators.group, "");

  if (separators.decimal === CANONICAL_DECIMAL_SEPARATOR) return ungrouped;
  return ungrouped.replaceAll(separators.decimal, CANONICAL_DECIMAL_SEPARATOR);
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
