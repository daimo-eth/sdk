import { describe, expect, test } from "vitest";

import type {
  AccountDepositStatus,
  AccountRail,
} from "../../../common/account.js";
import type { DaimoPlatform } from "../../platform.js";
import {
  getAccountPaymentAdvanceTarget,
  getDepositResumeTarget,
} from "./accountNav.js";

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

  test("pix is not exposed in the modal checkout", () => {
    expect(() => getAccountPaymentAdvanceTarget("pix", "desktop")).toThrow(
      "pix account deposits are api-only",
    );
  });
});

describe("getDepositResumeTarget", () => {
  // Exhaustive: adding a deposit status must force a decision here.
  const ALL_STATUSES: AccountDepositStatus[] = [
    "initiated",
    "awaiting_payment",
    "payment_received",
    "token_delivered",
    "completed",
    "expired",
    "failed",
  ];

  test("deposits past payment resume at the status page", () => {
    const resumed: AccountDepositStatus[] = [
      "payment_received",
      "token_delivered",
      "completed",
      "failed",
      "expired",
    ];
    for (const status of resumed) {
      expect(getDepositResumeTarget(status)).toBe("account-status");
    }
  });

  test("pre-payment deposits re-enter the normal flow", () => {
    expect(getDepositResumeTarget("initiated")).toBeNull();
    expect(getDepositResumeTarget("awaiting_payment")).toBeNull();
  });

  test("every status has a decision", () => {
    for (const status of ALL_STATUSES) {
      const target = getDepositResumeTarget(status);
      expect(target === "account-status" || target === null).toBe(true);
    }
  });
});
