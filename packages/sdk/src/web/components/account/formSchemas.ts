import { z } from "zod";

export const zLegalNameForm = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "enter your first name")
    .max(80, "first name is too long"),
  lastName: z
    .string()
    .trim()
    .min(1, "enter your last name")
    .max(80, "last name is too long"),
});

const zDigits = (length: number, message: string) =>
  z.string().regex(new RegExp(`^\\d{${length}}$`), message);

const zDateOfBirthForm = z
  .object({
    month: z.string(),
    day: z.string(),
    year: z.string(),
  })
  .superRefine((value, ctx) => {
    const parsed = parseDateOfBirth(value);
    if (parsed != null) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "enter a valid date of birth",
      path: ["month"],
    });
  })
  .transform((value) => {
    const parsed = parseDateOfBirth(value);
    if (parsed == null) {
      throw new Error("invalid date of birth");
    }
    return parsed;
  });

export const zApplePayVerificationForm = z.object({
  ssnLast4: zDigits(4, "enter the last 4 digits of your SSN"),
  dateOfBirth: zDateOfBirthForm,
});

export type LegalNameFormValues = z.input<typeof zLegalNameForm>;
export type ApplePayVerificationFormValues = z.input<
  typeof zApplePayVerificationForm
>;
export type ApplePayVerificationSubmitValues = z.output<
  typeof zApplePayVerificationForm
>;

export function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function parseDateOfBirth(value: {
  day: string;
  month: string;
  year: string;
}): { day: string; month: string; year: string } | null {
  if (!/^\d{1,2}$/.test(value.month)) return null;
  if (!/^\d{1,2}$/.test(value.day)) return null;
  if (!/^\d{4}$/.test(value.year)) return null;
  if (!isDatePartInRange(value.month, 1, 12)) return null;
  if (!isDatePartInRange(value.day, 1, 31)) return null;

  const month = value.month.padStart(2, "0");
  const day = value.day.padStart(2, "0");
  const year = value.year;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return { day, month, year };
}

export function isDatePartInRange(
  value: string,
  min: number,
  max: number,
): boolean {
  if (!/^\d+$/.test(value)) return false;
  const num = Number(value);
  return num >= min && num <= max;
}
