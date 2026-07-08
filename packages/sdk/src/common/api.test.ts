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
});
