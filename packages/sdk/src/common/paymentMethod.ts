import { z } from "zod";

export const zPaymentMethodId = z.enum([
  "ConnectedWallet",
  "Interac",
  "ACH",
  "SEPA",
  "ApplePay",
  "CashApp",
  "Coinbase",
  "Binance",
  "BinanceUSDC",
  "BinanceUSDT",
  "Lemon",
  "BitgetExchange",
  "BybitExchange",
  "MtPelerin",
  "Tron",
  "ARS",
  "BreB",
  "JPYC",
  "Stripe",
]);

export type PaymentMethodId = z.infer<typeof zPaymentMethodId>;

/** Product grouping only. Execution is described by PaymentAction. */
export const zPaymentMethodCategory = z.enum([
  "wallet",
  "bank",
  "card",
  "paymentApp",
  "onramp",
  "exchange",
]);

export type PaymentMethodCategory = z.infer<typeof zPaymentMethodCategory>;

export const zMoney = z.object({
  currency: z.string().regex(/^[A-Z]{3,10}$/),
  units: z
    .string()
    .max(100)
    .regex(/^(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)$/),
});

export type Money = z.infer<typeof zMoney>;

export const zPaymentQuote = z.object({
  /** Money paid by the user. */
  sourceAmount: zMoney,
  /** Estimated money delivered before the source payment is observed. */
  estimatedDestinationAmount: zMoney,
  fees: z.array(
    z.object({
      kind: z.enum(["service", "network", "partner"]),
      amount: zMoney,
    }),
  ),
});

export type PaymentQuote = z.infer<typeof zPaymentQuote>;

/** What a client must do after creating a payment method. */
export const zPaymentAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("openUrl"),
    url: z.string().url(),
    presentation: z.enum(["popup", "qr"]),
    popupName: z.string().optional(),
    waitingMessage: z.string(),
    expiresAt: z.number().optional(),
    quote: zPaymentQuote.optional(),
  }),
  z.object({
    type: z.literal("embeddedWidget"),
    sdk: z.literal("stripeOnramp"),
    clientSecret: z.string(),
    publishableKey: z.string(),
    fallbackUrl: z.string().url(),
  }),
]);

export type PaymentAction = z.infer<typeof zPaymentAction>;
