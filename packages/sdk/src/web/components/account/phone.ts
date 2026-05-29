import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export function normalizeUsPhoneDigits(raw: string): string {
  const allDigits = raw.replace(/\D/g, "");
  const withoutCountryCode =
    allDigits.length > 10 && allDigits.startsWith("1")
      ? allDigits.slice(1)
      : allDigits;
  return withoutCountryCode.slice(0, 10);
}

export function normalizeUsPhoneLocalDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

export function formatUsPhoneInput(digits: string): string {
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `+1 ${digits}`;
  if (digits.length <= 6) {
    return `+1 ${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function formatUsPhoneLocal(digits: string): string {
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function formatUsPhoneDisplay(raw: string): string {
  const digits = normalizeUsPhoneDigits(raw);
  return digits.length === 0 ? raw : formatUsPhoneInput(digits);
}

export function parseUsPhoneNumber(raw: string): string | null {
  const phone = parsePhoneNumberFromString(raw, "US");
  if (!phone || !phone.isValid() || phone.country !== "US") return null;
  if (!/^\d{10}$/.test(phone.nationalNumber)) return null;
  return phone.number;
}
