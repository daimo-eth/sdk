import { describe, expect, test } from "vitest";

import type {
  AccountDepositStatus,
  AccountRail,
} from "../../../common/account.js";
import { shouldShowPixExpiredRecovery } from "./accountPixExpired.js";

const ALL_RAILS: AccountRail[] = [
  "ach",
  "apple_pay",
  "ars",
  "interac",
  "jpyc",
  "pix",
  "sepa",
];

const ALL_STATUSES: AccountDepositStatus[] = [
  "initiated",
  "awaiting_payment",
  "payment_received",
  "token_delivered",
  "completed",
  "expired",
  "failed",
];

describe("shouldShowPixExpiredRecovery", () => {
  test("only expired pix deposits get retry recovery", () => {
    for (const rail of ALL_RAILS) {
      for (const status of ALL_STATUSES) {
        expect(shouldShowPixExpiredRecovery(status, rail)).toBe(
          status === "expired" && rail === "pix",
        );
      }
    }
  });
});
