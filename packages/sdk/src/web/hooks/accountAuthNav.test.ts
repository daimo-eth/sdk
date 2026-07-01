import { describe, expect, test } from "vitest";

import { pruneCompletedAccountAuth } from "./accountAuthNav.js";
import type { NavEntry } from "./types.js";

const nodeId = "fiat";
const rail = "ars";

describe("account auth nav pruning", () => {
  test("prunes stale provider otp after account enrollment completes", () => {
    const stack: NavEntry[] = [
      { type: "choose-option", nodeId: "root", autoNav: true },
      { type: "account-provider-otp", nodeId, rail },
      { type: "account-enrollment", nodeId, rail },
    ];

    expect(pruneCompletedAccountAuth(stack, "account-enrollment")).toEqual([
      { type: "choose-option", nodeId: "root", autoNav: true },
      { type: "account-enrollment", nodeId, rail },
    ]);
  });

  test("keeps auth entries when entering provider otp challenge", () => {
    const stack: NavEntry[] = [
      { type: "account-email", nodeId, rail },
      { type: "account-enrollment", nodeId, rail },
    ];

    expect(pruneCompletedAccountAuth(stack, "account-provider-otp")).toBe(stack);
  });

  test("keeps existing phone otp challenge behavior", () => {
    const stack: NavEntry[] = [
      { type: "account-phone", nodeId, rail },
      { type: "account-enrollment", nodeId, rail },
    ];

    expect(pruneCompletedAccountAuth(stack, "account-phone-otp")).toBe(stack);
  });
});
