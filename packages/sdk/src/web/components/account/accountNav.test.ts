import { describe, expect, test } from "vitest";

import type { AccountRail } from "../../../common/account.js";
import type { DaimoPlatform } from "../../platform.js";
import { getAccountPaymentAdvanceTarget } from "./accountNav.js";

const ALL_PLATFORMS: DaimoPlatform[] = [
  "desktop",
  "mobile",
  "ios",
  "android",
  "other",
];

describe("getAccountPaymentAdvanceTarget", () => {
  test("interac shows the bank picker on desktop", () => {
    expect(getAccountPaymentAdvanceTarget("interac", "desktop")).toBe(
      "account-canada-bank-picker",
    );
    // isDesktop() treats "other" as desktop.
    expect(getAccountPaymentAdvanceTarget("interac", "other")).toBe(
      "account-canada-bank-picker",
    );
  });

  test("interac reviews before opening interac on mobile", () => {
    for (const platform of ["mobile", "ios", "android"] as const) {
      expect(getAccountPaymentAdvanceTarget("interac", platform)).toBe(
        "account-interac-confirm",
      );
    }
  });

  test("bank-details rails are unaffected by platform", () => {
    const rails: AccountRail[] = ["ach", "sepa", "jpyc", "ars"];
    for (const rail of rails) {
      for (const platform of ALL_PLATFORMS) {
        expect(getAccountPaymentAdvanceTarget(rail, platform)).toBe(
          "account-bank-details",
        );
      }
    }
  });

  test("apple_pay is unaffected by platform", () => {
    for (const platform of ALL_PLATFORMS) {
      expect(getAccountPaymentAdvanceTarget("apple_pay", platform)).toBe(
        "account-apple-pay",
      );
    }
  });
});
