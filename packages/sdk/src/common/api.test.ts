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

  test("continues to accept legacy Cash App exchange requests", () => {
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

  test("accepts typed external methods and source currencies", () => {
    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "external",
          id: "Revolut",
          countryCode: "DE",
          sourceAmount: {
            units: "10.50",
            currency: "EUR",
          },
        },
      }).paymentMethod,
    ).toEqual({
      type: "external",
      id: "Revolut",
      countryCode: "DE",
      sourceAmount: {
        units: "10.50",
        currency: "EUR",
      },
    });
  });

  test("accepts Cash App without a country", () => {
    expect(
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "external",
          id: "CashApp",
          sourceAmount: {
            units: "10.50",
            currency: "USD",
          },
        },
      }).paymentMethod,
    ).toEqual({
      type: "external",
      id: "CashApp",
      sourceAmount: {
        units: "10.50",
        currency: "USD",
      },
    });
  });

  test("rejects malformed source amounts without encoding method policy", () => {
    expect(() =>
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "external",
          id: "Revolut",
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
          type: "external",
          id: "Revolut",
          countryCode: "DE",
          sourceAmount: {
            units: "10.00",
            currency: "eur",
          },
        },
      }),
    ).toThrow();
  });

  test("keeps external methods out of the exchange enum", () => {
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

  test("rejects untyped external method IDs", () => {
    expect(() =>
      zCreatePaymentMethodRequest.parse({
        clientSecret: "secret",
        paymentMethod: {
          type: "external",
          id: "FutureExternalMethod",
          sourceAmount: {
            units: "10.00",
            currency: "EUR",
          },
        },
      }),
    ).toThrow();
  });
});
