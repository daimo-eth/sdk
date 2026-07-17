import { describe, expect, test } from "vitest";

import { pruneCompletedAccountAuth } from "./accountAuthNav.js";
import type { NavEntry } from "./types.js";

const nodeId = "fiat";
const rail = "apple_pay";
const paymentInteraction = "bank-transfer";

describe("account auth nav pruning", () => {
  test("prunes stale phone otp after account enrollment completes", () => {
    const stack: NavEntry[] = [
      { type: "choose-option", nodeId: "root", autoNav: true },
      { type: "account-phone-otp", nodeId, rail, paymentInteraction },
      { type: "account-enrollment", nodeId, rail, paymentInteraction },
    ];

    expect(pruneCompletedAccountAuth(stack, "account-enrollment")).toEqual([
      { type: "choose-option", nodeId: "root", autoNav: true },
      { type: "account-enrollment", nodeId, rail, paymentInteraction },
    ]);
  });

  test("keeps auth entries when entering phone otp challenge", () => {
    const stack: NavEntry[] = [
      { type: "account-email", nodeId, rail, paymentInteraction },
      { type: "account-enrollment", nodeId, rail, paymentInteraction },
    ];

    expect(pruneCompletedAccountAuth(stack, "account-phone-otp")).toBe(stack);
  });
});
