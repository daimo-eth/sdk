import { describe, expect, test } from "vitest";

import { zSourceAmount } from "./money.js";

describe("zSourceAmount", () => {
  test("supports provider-neutral currency units", () => {
    expect(zSourceAmount.parse({ currency: "EUR", units: "25.50" })).toEqual({
      currency: "EUR",
      units: "25.50",
    });
    expect(zSourceAmount.parse({ currency: "JPY", units: "950" })).toEqual({
      currency: "JPY",
      units: "950",
    });
  });
});
