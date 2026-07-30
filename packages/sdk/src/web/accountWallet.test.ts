import { describe, expect, test } from "vitest";

import { findCanonicalPrivyWallet } from "./accountWallet.js";

describe("wallet-scoped Privy selection", () => {
  test("finds the connected signing wallet regardless of address casing", () => {
    const wallet = {
      chainType: "ethereum",
      walletClientType: "privy",
      address: "0x1234567890abcdef1234567890abcdef12345678",
    };

    expect(
      findCanonicalPrivyWallet(
        [wallet],
        "0x1234567890AbcdEF1234567890aBcdef12345678",
      ),
    ).toBe(wallet);
  });
});
