import { describe, expect, test } from "vitest";

import {
  formatNavSourceAmountUnits,
  getNavExternalHandoff,
  getNavSourceAmount,
  type NavNodeExchange,
  type NavNodeExternalPayment,
} from "./navTree.js";

describe("external payment nav policy", () => {
  test("uses backend-provided amount and handoff descriptors", () => {
    const node: NavNodeExternalPayment = {
      type: "ExternalPayment",
      id: "ExternalPayment-Revolut",
      title: "Revolut",
      externalPaymentMethodId: "Revolut",
      countryCode: "JP",
      sourceAmount: {
        currency: "JPY",
        currencySymbol: "¥",
        decimals: 0,
        minimum: 100,
        maximum: 10000,
      },
      externalHandoff: {
        desktopBehavior: "popup",
        popupName: "future-hosted-method",
      },
    };

    expect(getNavSourceAmount(node)).toEqual(node.sourceAmount);
    expect(getNavExternalHandoff(node)).toEqual(node.externalHandoff);
    expect(formatNavSourceAmountUnits(125, node.sourceAmount)).toBe("125");
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
    ).toThrow("invalid external payment amount");
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
