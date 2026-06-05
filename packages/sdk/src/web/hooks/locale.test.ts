import { describe, expect, test } from "vitest";

import { getLocale, getNumberLocale, setLocale, t } from "./locale.js";

describe("locale selection", () => {
  test("selects Portuguese text for short locale", () => {
    setLocale("pt");

    expect(getLocale()).toBe("pt");
    expect(getNumberLocale()).toBe("pt");
    expect(t.selectAmount).toBe("Selecionar valor");
  });

  test("selects Portuguese text and preserves Brazilian number locale", () => {
    setLocale("pt-BR");

    expect(getLocale()).toBe("pt");
    expect(getNumberLocale()).toBe("pt-BR");
    expect(t.enterAmount).toBe("Inserir valor");
  });

  test("selects Portuguese text and preserves Portugal number locale", () => {
    setLocale("pt-PT");

    expect(getLocale()).toBe("pt");
    expect(getNumberLocale()).toBe("pt-PT");
    expect(t.deposit).toBe("Depositar");
  });

  test("falls back to English text and numbers for unknown translation locale", () => {
    setLocale("zz-ZZ");

    expect(getLocale()).toBe("en");
    expect(getNumberLocale()).toBe("en-US");
    expect(t.selectAmount).toBe("Select Amount");
  });

  test("falls back to English text but preserves local separators", () => {
    setLocale("de-DE");

    expect(getLocale()).toBe("en");
    expect(getNumberLocale()).toBe("de-DE-u-nu-latn");
    expect(t.minimum).toBe("Minimum");
  });

  test("falls back to English text and Latin digits for unsupported text locale", () => {
    setLocale("mr-IN");

    expect(getLocale()).toBe("en");
    expect(getNumberLocale()).toBe("mr-IN-u-nu-latn");
    expect(t.minimum).toBe("Minimum");
  });
});
