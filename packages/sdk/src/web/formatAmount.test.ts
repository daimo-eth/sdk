import { describe, expect, test } from "vitest";

import {
  formatAmountInput,
  formatFixedAmount,
  isValidAmountInput,
  normalizeFractionDigits,
  parseDisplayAmount,
} from "./formatAmount.js";
import { setLocale } from "./hooks/locale.js";

describe("amount input formatting", () => {
  test("parses and formats en-us display amounts", () => {
    setLocale("en-US");

    expect(parseDisplayAmount("100,000.00")).toBe("100000.00");
    expect(formatAmountInput("100000.00")).toBe("100,000.00");
    expect(parseDisplayAmount("1,23")).toBe("1.23");
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

    const parsed = parseDisplayAmount("0,1234");
    expect(parsed).toBe("0.1234");
    if (parsed == null) throw new Error("expected parsed amount");
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

  test("bounds unsafe server-provided fraction digits", () => {
    setLocale("en-US");

    expect(normalizeFractionDigits(21)).toBe(20);
    expect(normalizeFractionDigits(-1)).toBe(0);
    expect(normalizeFractionDigits(Number.NaN)).toBe(2);
    expect(formatFixedAmount(5, 21)).toBe(`5.${"0".repeat(20)}`);
    expect(isValidAmountInput(`1.${"1".repeat(21)}`, 21)).toBe(false);
  });
});

describe("pasted amounts", () => {
  test.each(["en-US", "de-DE", "pt-BR", "fr-FR"])(
    "accepts unambiguous amounts in %s",
    (locale) => {
      for (const [input, expected] of [
        ["12,50", "12.50"],
        ["12.50", "12.50"],
        [",5", ".5"],
        [".5", ".5"],
        ["12,", "12."],
        ["12.", "12."],
        ["1234", "1234"],
        ["1,234.50", "1234.50"],
        ["1.234,50", "1234.50"],
        ["1,234,567", "1234567"],
        ["1.234.567", "1234567"],
        [" 12,50 ", "12.50"],
      ])
        expect(parseDisplayAmount(input, locale)).toBe(expected);
    },
  );

  test.each(["en-US", "de-DE", "pt-BR", "fr-FR"])(
    "rejects ambiguous and malformed amounts in %s",
    (locale) => {
      for (const input of [
        "1,234",
        "1.234",
        "12,345",
        "12.345",
        "12,34.50",
        "1,23,456",
        "12.34,50",
        "1.23.456",
        "1,,2",
        "1..2",
        "1,2,3",
        "1.2.3",
        "-12,50",
        "1e3",
        "12 CAD",
        "NaN",
        "Infinity",
        "12 50",
      ])
        expect(parseDisplayAmount(input, locale), input).toBeNull();
    },
  );

  test("preserves the locale's space grouping", () => {
    expect(parseDisplayAmount("1\u202f234,50", "fr-FR")).toBe("1234.50");
  });
});
