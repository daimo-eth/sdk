import { describe, expect, test } from "vitest";

import { getAuthorizedDepositAmount } from "./useDraftDeposit.js";

describe("getAuthorizedDepositAmount", () => {
  test("uses the server-provided purchase amount for request-to-pay", () => {
    expect(
      getAuthorizedDepositAmount({ purchaseAmount: "99.75" }, "100"),
    ).toBe("99.75");
  });

  test("uses the requested deposit amount for flows without a quote", () => {
    expect(getAuthorizedDepositAmount({ flow: "bank-transfer" }, "100")).toBe(
      "100",
    );
  });
});
