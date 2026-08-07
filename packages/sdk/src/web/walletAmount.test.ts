import { describe, expect, it } from "vitest";
import { getAddress } from "viem";

import type {
  DaimoPayToken,
  DaimoPayTokenAmount,
  WalletPaymentOption,
} from "./api/walletTypes.js";
import { getWalletTokenAmount } from "./walletAmount.js";

const token: DaimoPayToken = {
  chainId: 8453,
  token: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  symbol: "USDC",
  decimals: 6,
  fiatISO: "USD",
  logoURI: "",
  logoSourceURI: "",
  usd: 2,
  priceFromUsd: 0.5,
  maxAcceptUsd: 1_000,
  maxSendUsd: 1_000,
  displayDecimals: 2,
};

describe("wallet token amount", () => {
  it("calculates a proportional raw amount and caps it at the balance", () => {
    const option = makeOption({ amount: "5000000", usd: 10 });

    expect(getWalletTokenAmount(option, 4)).toBe(2_000_000n);
    expect(getWalletTokenAmount(option, 12)).toBe(5_000_000n);
  });

  it("uses the server-required raw amount for fixed sessions", () => {
    const option = makeOption({ amount: "5000000", usd: 10 });
    option.required = { token, amount: "1234567", usd: 2.5 };

    expect(getWalletTokenAmount(option, 999)).toBe(1_234_567n);
  });

  it("rejects open-amount calculations with a zero USD balance", () => {
    const option = makeOption({ amount: "5000000", usd: 0 });
    expect(() => getWalletTokenAmount(option, 1)).toThrow(
      "balance must be positive",
    );
  });
});

function makeOption(
  balance: Pick<DaimoPayTokenAmount, "amount" | "usd">,
): WalletPaymentOption {
  const zero: DaimoPayTokenAmount = { token, amount: "0", usd: 0 };
  return {
    balance: { ...balance, token },
    required: zero,
    minimumRequired: zero,
    fees: zero,
  };
}
