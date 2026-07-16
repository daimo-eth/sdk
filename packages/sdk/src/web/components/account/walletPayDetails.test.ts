import { describe, expect, test } from "vitest";

import type { DepositLimit } from "../../../common/account.js";
import { getWalletPayLimitDetails } from "./walletPayDetails.js";

describe("getWalletPayLimitDetails", () => {
  test("summarizes weekly capacity and lifetime purchases", () => {
    expect(
      getWalletPayLimitDetails(
        [
          makeLimit({
            key: "amount.weekly",
            unit: "fiat",
            period: "week",
            limit: "500",
            remaining: "450",
            currency: { code: "USD", symbol: "$" },
          }),
          makeLimit({
            key: "transactions.lifetime",
            unit: "count",
            period: "lifetime",
            limit: "15",
            remaining: "14",
          }),
        ],
        "$",
      ),
    ).toEqual({
      weeklyRemaining: "$450",
      depositCountRemaining: "14 deposits",
    });
  });

  test("renders unbounded provider limits as unlimited", () => {
    expect(
      getWalletPayLimitDetails(
        [
          makeLimit({
            key: "amount.weekly",
            unit: "fiat",
            period: "week",
            limit: null,
            remaining: null,
          }),
          makeLimit({
            key: "transactions.lifetime",
            unit: "count",
            period: "lifetime",
            limit: null,
            remaining: null,
          }),
        ],
        "$",
      ),
    ).toEqual({
      weeklyRemaining: "Unlimited",
      depositCountRemaining: "Unlimited deposits",
    });
  });

  test("omits malformed and unavailable limits", () => {
    expect(
      getWalletPayLimitDetails(
        [
          makeLimit({
            key: "amount.weekly",
            unit: "fiat",
            period: "week",
            limit: "500",
            remaining: "unknown",
          }),
        ],
        "$",
      ),
    ).toEqual({ weeklyRemaining: null, depositCountRemaining: null });
    expect(getWalletPayLimitDetails(undefined, "$")).toEqual({
      weeklyRemaining: null,
      depositCountRemaining: null,
    });
  });

  test("caps non-constraining provider purchase counts", () => {
    expect(
      getWalletPayLimitDetails(
        [
          makeLimit({
            key: "transactions.lifetime",
            unit: "count",
            period: "lifetime",
            limit: "2147483647",
            remaining: "2147483647",
          }),
        ],
        "$",
      ),
    ).toEqual({
      weeklyRemaining: null,
      depositCountRemaining: "100+ deposits",
    });
  });
});

function makeLimit(limit: Partial<DepositLimit>): DepositLimit {
  return {
    key: "test",
    label: "Test limit",
    unit: "count",
    limit: "1",
    remaining: "1",
    ...limit,
  };
}
