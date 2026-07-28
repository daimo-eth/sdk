import { describe, expect, test } from "vitest";

import { zCreatePaymentMethodRequest } from "./api.js";

describe("zCreatePaymentMethodRequest", () => {
  test("accepts canonical USD exchange requests", () => {
    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "exchange",
          exchangeId: "Coinbase",
          amountUsd: 10,
        },
      }).paymentMethod,
    ).toEqual({
      type: "exchange",
      exchangeId: "Coinbase",
      amountUsd: 10,
    });
  });

  test("accepts backend-defined hosted methods and source currencies", () => {
    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "hosted",
          hostedPaymentMethodId: "FutureHostedMethod",
          countryCode: "DE",
          sourceAmount: {
            units: "10.50",
            currency: "EUR",
          },
        },
      }).paymentMethod,
    ).toEqual({
      type: "hosted",
      hostedPaymentMethodId: "FutureHostedMethod",
      countryCode: "DE",
      sourceAmount: {
        units: "10.50",
        currency: "EUR",
      },
    });
  });

  test("rejects malformed source amounts without encoding provider policy", () => {
    expect(() =>
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "hosted",
          hostedPaymentMethodId: "FutureHostedMethod",
          countryCode: "DE",
          sourceAmount: {
            units: "0",
            currency: "EUR",
          },
        },
      }),
    ).toThrow();
    expect(() =>
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "hosted",
          hostedPaymentMethodId: "FutureHostedMethod",
          countryCode: "DE",
          sourceAmount: {
            units: "10.00",
            currency: "eur",
          },
        },
      }),
    ).toThrow();
  });

  test("keeps hosted methods out of the exchange enum", () => {
    expect(() =>
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "exchange",
          exchangeId: "Revolut",
          amountUsd: 10,
        },
      }),
    ).toThrow();
  });
});
