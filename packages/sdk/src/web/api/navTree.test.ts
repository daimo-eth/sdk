import { describe, expect, test } from "vitest";

import {
  formatNavSourceAmountUnits,
  getNavExternalHandoff,
  getNavSourceAmount,
  type NavNodeExchange,
  type NavNodeHostedPayment,
} from "./navTree.js";

describe("external payment nav policy", () => {
  test("uses backend-provided amount and handoff descriptors", () => {
    const node: NavNodeHostedPayment = {
      type: "HostedPayment",
      id: "HostedPayment-FutureHostedMethod",
      title: "Future hosted method",
      hostedPaymentMethodId: "FutureHostedMethod",
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

  test("falls back to legacy USD nav fields without provider checks", () => {
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
      desktopBehavior: "qr",
      placeholderDensity: "short",
    });
  });
});
