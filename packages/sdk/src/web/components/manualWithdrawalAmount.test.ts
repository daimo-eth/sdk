import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { getAddress } from "viem";

import type {
  DaimoPayToken,
  DaimoPayTokenAmount,
  WalletPaymentOption,
} from "../api/walletTypes.js";
import { setLocale } from "../hooks/locale.js";
import {
  filterWithdrawalWalletOptions,
  ManualWithdrawalAmountPage,
  type DaimoWithdrawalProps,
} from "./DaimoWithdrawal.js";
import { TokenAmountEntry } from "./TokenAmountEntry.js";
import { WalletAmountPage } from "./WalletAmountPage.js";

const token: DaimoPayToken = {
  chainId: 8453,
  token: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  symbol: "USDC",
  decimals: 6,
  fiatISO: "USD",
  logoURI: "usdc.svg",
  logoSourceURI: "",
  usd: 1,
  priceFromUsd: 1,
  maxAcceptUsd: 1_000,
  maxSendUsd: 1_000,
  displayDecimals: 2,
};

beforeEach(() => setLocale("en"));

describe("manual withdrawal amount pages", () => {
  it("renders generic USD entry without token, balance, or Max UI", () => {
    const html = renderToStaticMarkup(
      createElement(ManualWithdrawalAmountPage, { onContinue: () => {} }),
    );

    expect(html).toContain("Enter Amount");
    expect(html).toContain("Minimum $0.01");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("Balance");
    expect(html).not.toContain(">Max<");
    expect(html).not.toContain("USDC");
  });

  it("shows Max immediately on wallet amount pages", () => {
    const html = renderToStaticMarkup(
      createElement(WalletAmountPage, {
        token: makeWalletOption(),
        platform: "mobile",
        onBack: () => {},
        onContinue: () => {},
        baseUrl: "https://daimo.com",
      }),
    );

    expect(html).toContain(">Max<");
    expect(html).toContain("Balance");
    expect(html).toContain("USDC");
  });

  it("shows server-provided limits on withdrawal wallet amount pages", () => {
    const option = makeWalletOption({
      ...token,
      maxAcceptUsd: 5_000,
    });
    option.balance.usd = 50;
    option.balance.amount = "50000000";
    option.minimumRequired.usd = 5;

    const html = renderToStaticMarkup(
      createElement(WalletAmountPage, {
        token: option,
        platform: "mobile",
        onBack: () => {},
        onContinue: () => {},
        baseUrl: "https://daimo.com",
        showLimits: true,
      }),
    );

    expect(html).toContain("Minimum $5.00 · Maximum $5,000.00");
    expect(html).toContain("Balance: $50.00");
  });

  it("hides Max when account and fiat entry disable it", () => {
    const html = renderToStaticMarkup(
      createElement(TokenAmountEntry, {
        token,
        minimumUsd: 0.01,
        maximumUsd: 1_000,
        nativeDisplay: { kind: "prefix", symbol: "$" },
        onContinue: () => {},
        showMax: false,
        platform: "mobile",
        baseUrl: "https://daimo.com",
      }),
    );

    expect(html).not.toContain(">Max<");
  });

  it("filters unsupported manual source tokens before rendering", () => {
    const worldToken = {
      ...token,
      chainId: 480,
      token: getAddress("0x1111111111111111111111111111111111111111"),
    };
    const solanaToken = {
      ...token,
      chainId: 501,
      token: getAddress("0x2222222222222222222222222222222222222222"),
    };

    expect(
      filterWithdrawalWalletOptions(
        [
          makeWalletOption(token),
          makeWalletOption(worldToken),
          makeWalletOption(solanaToken),
        ],
        (candidate) => candidate.chainId === 480,
      ),
    ).toEqual([makeWalletOption(worldToken)]);
  });
});

function makeWalletOption(sourceToken = token): WalletPaymentOption {
  const zero: DaimoPayTokenAmount = {
    token: sourceToken,
    amount: "0",
    usd: 0,
  };
  return {
    balance: { token: sourceToken, amount: "10000000", usd: 10 },
    required: zero,
    minimumRequired: { token, amount: "10000", usd: 0.01 },
    fees: zero,
  };
}

const manualBaseProps = {
  contactStorageScope: "account-1",
  resolveEns: async () => ({
    address: getAddress("0x1111111111111111111111111111111111111111"),
  }),
  createSession: async () => ({
    sessionId: "session-1",
    clientSecret: "secret-1",
  }),
  sendManualTransaction: async () => ({ txHash: "0x1234" as const }),
};
const fixedManualProps: DaimoWithdrawalProps = {
  ...manualBaseProps,
  fundingMode: "manual",
  amountUnits: "1.25",
};
const genericManualProps: DaimoWithdrawalProps = {
  ...manualBaseProps,
  fundingMode: "manual",
};
const addressAwareManualProps: DaimoWithdrawalProps = {
  ...manualBaseProps,
  fundingMode: "manual",
  connectToAddress: getAddress("0x2222222222222222222222222222222222222222"),
};
// @ts-expect-error fixed manual amounts cannot also select an address
const invalidAmountAndAddressProps: DaimoWithdrawalProps = {
  ...manualBaseProps,
  fundingMode: "manual",
  amountUnits: "1.25",
  connectToAddress: getAddress("0x2222222222222222222222222222222222222222"),
};
// @ts-expect-error manual funding never accepts an EIP-1193 provider
const invalidManualProviderProps: DaimoWithdrawalProps = {
  ...manualBaseProps,
  fundingMode: "manual",
  evmProvider: { request: async () => null },
};
void [
  fixedManualProps,
  genericManualProps,
  addressAwareManualProps,
  invalidAmountAndAddressProps,
  invalidManualProviderProps,
];
