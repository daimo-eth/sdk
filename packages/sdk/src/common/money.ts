import { z } from "zod";

/** ISO 4217-style currency metadata for display. */
export type Currency = {
  code: string;
  symbol: string;
};

export const zCurrencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "currency must be an uppercase ISO 4217 code");

export const zAmountUnits = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.\d+)?$/, "units must be a decimal string");

/** Amount in the currency the payer supplies, expressed in decimal units. */
export const zSourceAmount = z.object({
  currency: zCurrencyCode,
  units: zAmountUnits,
});

export type SourceAmount = z.infer<typeof zSourceAmount>;
