import { describe, expect, test } from "vitest";

import {
  formatNavSourceAmountUnits,
  getNavExternalHandoff,
  getNavSourceAmount,
  hasCanonicalPaymentMethod,
  type NavNodeExchange,
  type NavNodePaymentMethod,
} from "./navTree.js";

describe("payment method nav policy", () => {
  test("uses the canonical method descriptor", () => {
    const node: NavNodePaymentMethod = {
      type: "PaymentMethod",
      id: "PaymentMethod-MtPelerin",
      title: "Mt Pelerin",
      methodId: "MtPelerin",
      category: "onramp",
      countryCode: "CH",
      sourceAmount: {
        currency: "EUR",
        currencySymbol: "€",
        decimals: 2,
        minimum: 10,
        maximum: 1000,
      },
    };

    expect(getNavSourceAmount(node)).toEqual(node.sourceAmount);
    expect(formatNavSourceAmountUnits(125, node.sourceAmount)).toBe("125.00");
  });

  test("rejects invalid backend amount precision", () => {
    expect(() =>
      formatNavSourceAmountUnits(10, {
        currency: "EUR",
        currencySymbol: "€",
        decimals: 21,
        minimum: 1,
        maximum: 100,
      }),
    ).toThrow("invalid payment method amount");
  });

  test("falls back to legacy USD nav fields", () => {
    const node: NavNodeExchange = {
      type: "Exchange",
      id: "Exchange-Coinbase",
      title: "Coinbase",
      exchangeId: "Coinbase",
      requiredUsd: 10,
      minimumUsd: 1,
      maximumUsd: 100,
    };

    expect(getNavSourceAmount(node)).toEqual({
      currency: "USD",
      currencySymbol: "$",
      decimals: 2,
      required: 10,
      minimum: 1,
      maximum: 100,
    });
    expect(getNavExternalHandoff(node)).toEqual({
      desktopBehavior: "popup",
      legacyQrPlaceholderDensity: "short",
    });
  });

  test("recognizes canonical metadata on a compatibility node", () => {
    const node: NavNodeExchange = {
      type: "Exchange",
      id: "Exchange-MtPelerin",
      title: "Mt Pelerin",
      exchangeId: "MtPelerin",
      methodId: "MtPelerin",
      category: "onramp",
      sourceAmount: {
        currency: "EUR",
        currencySymbol: "€",
        decimals: 2,
        minimum: 10,
        maximum: 1000,
      },
      minimumUsd: 10,
      maximumUsd: 1000,
    };

    expect(hasCanonicalPaymentMethod(node)).toBe(true);
  });

  test.each([
    ["Coinbase", "popup", "short"],
    ["MtPelerin", "popup", "short"],
    ["Binance", "qr", "medium"],
    ["BinanceUSDC", "qr", "medium"],
    ["BinanceUSDT", "qr", "medium"],
    ["Lemon", "qr", "short"],
  ] as const)(
    "preserves legacy %s handoff behavior",
    (exchangeId, desktopBehavior, legacyQrPlaceholderDensity) => {
      const node: NavNodeExchange = {
        type: "Exchange",
        id: `Exchange-${exchangeId}`,
        title: exchangeId,
        exchangeId,
        minimumUsd: 1,
        maximumUsd: 100,
      };

      expect(getNavExternalHandoff(node)).toEqual({
        desktopBehavior,
        legacyQrPlaceholderDensity,
      });
    },
  );
});
