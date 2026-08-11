import { describe, expect, test } from "vitest";

import type { GetAccountResponse } from "../../common/account.js";
import {
  getAccountAuthDecision,
  pruneCompletedAccountAuth,
} from "./accountAuthNav.js";
import type { NavEntry } from "./types.js";

const nodeId = "fiat";
const rail = "apple_pay";
const paymentInteraction = "bank-transfer";
const existingAccount = {
  account: {
    id: "account-a",
    email: "account-a@example.com",
    walletAddress: "0x0000000000000000000000000000000000000001",
  },
  nextAction: "ready_for_payment",
} as const satisfies GetAccountResponse;

describe("account identity priority", () => {
  test("uses the authenticated Daimo Account instead of an email hint", () => {
    expect(
      getAccountAuthDecision({
        isAuthenticated: true,
        accessToken: "privy-token",
        accountResponse: existingAccount,
      }),
    ).toEqual({ type: "existing-account", response: existingAccount });
  });

  test("creates the Account for an authenticated Privy user", () => {
    expect(
      getAccountAuthDecision({
        isAuthenticated: true,
        accessToken: "privy-token",
        accountResponse: { account: null, nextAction: "create_account" },
      }),
    ).toEqual({ type: "create-account" });
  });

  test.each([
    { isAuthenticated: true, accessToken: null, accountResponse: null },
    {
      isAuthenticated: true,
      accessToken: "privy-token",
      accountResponse: null,
    },
  ])("does not use an email hint when Account lookup fails", (params) => {
    expect(getAccountAuthDecision(params)).toEqual({ type: "error" });
  });

  test("uses an email hint only without an authenticated identity", () => {
    expect(
      getAccountAuthDecision({
        isAuthenticated: false,
        accessToken: null,
        accountResponse: null,
      }),
    ).toEqual({ type: "email-hint" });
  });
});

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
