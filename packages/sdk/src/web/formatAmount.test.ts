import { describe, expect, test } from "vitest";

import {
  formatAmountInput,
  formatFixedAmount,
  isValidAmountInput,
  parseDisplayAmount,
} from "./formatAmount.js";
import { setLocale } from "./hooks/locale.js";

describe("amount input formatting", () => {
  test("parses and formats en-us display amounts", () => {
    setLocale("en-US");

    expect(parseDisplayAmount("100,000.00")).toBe("100000.00");
    expect(formatAmountInput("100000.00")).toBe("100,000.00");
    expect(parseDisplayAmount("1,23")).toBe("123");
  });

  test("parses and formats pt-br display amounts", () => {
    setLocale("pt-BR");

    expect(parseDisplayAmount("100.000,00")).toBe("100000.00");
    expect(formatAmountInput("100000.00")).toBe("100.000,00");
    expect(parseDisplayAmount("1,5")).toBe("1.5");
    expect(parseDisplayAmount("1.234,")).toBe("1234.");
    expect(formatAmountInput("1.5")).toBe("1,5");
    expect(formatAmountInput("0.00")).toBe("0,00");
  });

  test("validates canonical amount input without reparsing", () => {
    setLocale("pt-BR");

    const parsed = parseDisplayAmount("1,234");
    expect(parsed).toBe("1.234");
    expect(isValidAmountInput(parsed, 2)).toBe(false);
    expect(isValidAmountInput("1.5", 2)).toBe(true);
    expect(formatAmountInput("1.5")).toBe("1,5");
  });

  test("uses local separators for unsupported text locales", () => {
    setLocale("de-DE");

    expect(parseDisplayAmount("100.000,00")).toBe("100000.00");
    expect(formatAmountInput("100000.00")).toBe("100.000,00");
    expect(formatFixedAmount(5)).toBe("5,00");
  });

  test("falls back to latin digits for unsupported locales", () => {
    setLocale("mr-IN");

    expect(formatFixedAmount(5)).toBe("5.00");
  });

  test("formats fixed amounts with numeric locale", () => {
    setLocale("pt-BR");

    expect(formatFixedAmount(1234.5)).toBe("1.234,50");
  });
});
