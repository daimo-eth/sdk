import { describe, expect, it } from "vitest";

import { getWalletPayName } from "./walletPayName.js";

describe("getWalletPayName", () => {
  it("shows Apple Pay before its payment details load", () => {
    expect(getWalletPayName("apple_pay", null)).toBe("Apple Pay");
  });

  it("uses the loaded wallet-pay kind when available", () => {
    expect(getWalletPayName("apple_pay", "apple_pay")).toBe("Apple Pay");
    expect(getWalletPayName("apple_pay", "google_pay")).toBe("Google Pay");
  });

  it("keeps the generic fallback for other future wallet-pay rails", () => {
    expect(getWalletPayName("ach", null)).toBe("Wallet Pay");
  });
});
