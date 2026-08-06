import { describe, expect, test } from "vitest";
import type { NavNodeExchange } from "../api/navTree.js";

import {
  getExchangeAmount,
  getRequiredExchangeAmount,
} from "./useSessionNav.js";

function exchangeNode(requiredUnits?: string): NavNodeExchange {
  return {
    id: "coinbase",
    title: "Coinbase",
    type: "Exchange",
    exchangeId: "Coinbase",
    sourceAmount: {
      currency: { code: "EUR", symbol: "€", decimals: 18 },
      requiredUnits,
      minimumUnits: "0.01",
      maximumUnits: "10000",
    },
  };
}

describe("required exchange amount", () => {
  test("preserves the server-provided decimal string exactly", () => {
    const requiredUnits = "123456789012345678.123456789012345678";

    expect(getRequiredExchangeAmount(exchangeNode(requiredUnits))).toEqual({
      sourceAmount: { currency: "EUR", units: requiredUnits },
    });
  });

  test.each([undefined, "0", "0.000000"])(
    "returns null for a missing or zero amount (%s)",
    (requiredUnits) => {
      expect(getRequiredExchangeAmount(exchangeNode(requiredUnits))).toBeNull();
    },
  );
});

describe("user-entered exchange amount", () => {
  test("preserves the validated decimal input without float artifacts", () => {
    expect(getExchangeAmount(exchangeNode(), 25.1, "25.1")).toEqual({
      sourceAmount: { currency: "EUR", units: "25.1" },
    });
  });

  test.each([
    [".5", "0.5"],
    ["00025.100", "25.100"],
    ["25.", "25"],
  ])("normalizes %s to canonical units %s", (input, expected) => {
    expect(getExchangeAmount(exchangeNode(), Number(input), input)).toEqual({
      sourceAmount: { currency: "EUR", units: expected },
    });
  });
});
