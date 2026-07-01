import { describe, expect, test } from "vitest";

import { zCreatePaymentMethodRequest } from "./api.js";

describe("zCreatePaymentMethodRequest", () => {
  test("accepts Binance_USDC and Binance_USDT exchange ids", () => {
    for (const exchangeId of ["Binance_USDC", "Binance_USDT"] as const) {
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
});
