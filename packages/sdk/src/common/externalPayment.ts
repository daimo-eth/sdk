import { z } from "zod";

export const zExternalPaymentMethodId = z.enum(["CashApp", "Revolut"]);

export type ExternalPaymentMethodId = z.infer<typeof zExternalPaymentMethodId>;

export type Money = {
  /** ISO 4217 currency or asset symbol. */
  currency: string;
  /** Decimal amount in currency units. */
  units: string;
};

export type ExternalPayment = {
  /** URL where the user completes the external payment. */
  url: string;
  /** Message to display while waiting for the payment. */
  waitingMessage: string;
  /** Link expiry time (unix seconds), when supplied by the backend. */
  expiresAt?: number;
  /** Optional estimate for quoted external payments. */
  quote?: ExternalPaymentQuote;
};

export type ExternalPaymentQuote = {
  /** Money paid by the user. */
  sourceAmount: Money;
  /** Estimated money delivered before the on-chain payment is observed. */
  estimatedDestinationAmount: Money;
  fees: {
    kind: "service" | "network" | "partner";
    amount: Money;
  }[];
};
