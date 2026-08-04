import { describe, expect, test } from "vitest";

import { zCreatePaymentMethodRequest } from "./api.js";

describe("zCreatePaymentMethodRequest", () => {
  test("accepts BinanceUSDC and BinanceUSDT exchange ids", () => {
    for (const exchangeId of ["BinanceUSDC", "BinanceUSDT"] as const) {
      expect(
        zCreatePaymentMethodRequest.parse({
          clientSecret: "secret",
          paymentMethod: {
            type: "exchange",
            exchangeId,
            amountUsd: 10,
          },
        }).paymentMethod,
      ).toEqual({
        type: "exchange",
        exchangeId,
        amountUsd: 10,
      });
    }
  });

  test("accepts a currency-aware Revolut source amount", () => {
    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "exchange",
          exchangeId: "RevolutRamp",
          sourceAmount: { currency: "EUR", units: "25.50" },
        },
      }).paymentMethod,
    ).toEqual({
      type: "exchange",
      exchangeId: "RevolutRamp",
      sourceAmount: { currency: "EUR", units: "25.50" },
    });
  });

  test("requires exactly one exchange amount representation", () => {
    const request = {
      clientSecret: "secret",
      paymentMethod: {
        type: "exchange",
        exchangeId: "RevolutRamp",
      },
    };
    expect(zCreatePaymentMethodRequest.safeParse(request).success).toBe(false);
    expect(
      zCreatePaymentMethodRequest.safeParse({
        ...request,
        paymentMethod: {
          ...request.paymentMethod,
          amountUsd: 25.5,
          sourceAmount: { currency: "EUR", units: "25.50" },
        },
      }).success,
    ).toBe(false);
  });

  test("rejects non-canonical source amounts", () => {
    for (const sourceAmount of [
      { currency: "eur", units: "25.50" },
      { currency: "EUR", units: "025.50" },
      { currency: "EUR", units: "25." },
    ]) {
      expect(
        zCreatePaymentMethodRequest.safeParse({
          clientSecret: "secret",
          paymentMethod: {
            type: "exchange",
            exchangeId: "RevolutRamp",
            sourceAmount,
          },
        }).success,
      ).toBe(false);
    }
  });
});
