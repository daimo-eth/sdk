const GROUP_SEPARATOR = ",";

export function parseDisplayAmount(value: string): string {
  return value.replaceAll(GROUP_SEPARATOR, "").trim();
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
