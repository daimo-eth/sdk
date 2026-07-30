import { describe, expect, test } from "vitest";

import type { PaymentMethodRequest } from "./api.js";
import { zCreatePaymentMethodRequest } from "./api.js";

describe("zCreatePaymentMethodRequest", () => {
  test("accepts canonical requests discriminated by method ID", () => {
    const paymentMethod: PaymentMethodRequest = {
      id: "CashApp",
      sourceAmount: {
        units: "10.50",
        currency: "USD",
      },
      platform: "ios",
    };

    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod,
      }).paymentMethod,
    ).toEqual(paymentMethod);
  });

  test("allows source currency independently of product category", () => {
    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          id: "MtPelerin",
          countryCode: "CH",
          sourceAmount: {
            units: "10.50",
            currency: "EUR",
          },
        },
      }).paymentMethod,
    ).toEqual({
      id: "MtPelerin",
      countryCode: "CH",
      sourceAmount: {
        units: "10.50",
        currency: "EUR",
      },
    });
  });

  test("accepts Stripe through the same request shape", () => {
    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          id: "Stripe",
          sourceAmount: {
            units: "25.00",
            currency: "USD",
          },
        },
      }).paymentMethod,
    ).toMatchObject({ id: "Stripe" });
  });

  test("rejects malformed source amounts", () => {
    expect(() =>
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          id: "CashApp",
          sourceAmount: {
            units: "0",
            currency: "USD",
          },
        },
      }),
    ).toThrow();
    expect(() =>
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          id: "CashApp",
          sourceAmount: {
            units: "10.00",
            currency: "usd",
          },
        },
      }),
    ).toThrow();
  });

  test("rejects unknown method IDs", () => {
    expect(() =>
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          id: "FutureMethod",
          sourceAmount: {
            units: "10.00",
            currency: "EUR",
          },
        },
      }),
    ).toThrow();
  });

  test("continues to accept legacy provider-shaped requests", () => {
    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "exchange",
          exchangeId: "CashApp",
          amountUsd: 10,
        },
      }).paymentMethod,
    ).toEqual({
      type: "exchange",
      exchangeId: "CashApp",
      amountUsd: 10,
    });
  });
});
