// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { setLocale } from "../hooks/locale.js";
import { AmountInput } from "./shared.js";
import { TokenAmountEntry } from "./TokenAmountEntry.js";

const token = {
  chainId: 8453,
  token: "0x0000000000000000000000000000000000000001",
  symbol: "CADC",
  decimals: 6,
  logoURI: "/coin.svg",
  logoSourceURI: "/coin.svg",
  usd: 0.75,
  priceFromUsd: 1,
  maxAcceptUsd: 10000,
  maxSendUsd: 10000,
  displayDecimals: 2,
};
let root: Root | null = null;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  setLocale("en-US");
});

describe.each(["amount", "fiat", "wallet"] as const)("%s input", (kind) => {
  test.each(["en-US", "de-DE"])("accepts decimal keys in %s", (locale) => {
    setLocale(locale);
    const { input, submitted, submit } = mountInput(kind);
    for (const separator of [",", "."]) {
      edit(input, "");
      for (const character of `1234${separator}50`) type(input, character);
      expect(input.value).toBe("1234.50");
      submit();
      expect(submitted).toHaveBeenLastCalledWith(1234.5);
      edit(input, input.value.slice(0, -2));
      expect(input.value).toBe("1234.");
      edit(input, input.value.slice(0, -1));
      expect(input.value).toBe("1234");
      edit(input, "");
      expect(input.value).toBe("");
      for (const character of `${separator}5`) type(input, character);
      submit();
      expect(submitted).toHaveBeenLastCalledWith(0.5);
    }
  });

  test("normalizes whole-value edits and rejects invalid amounts", () => {
    const { input, submitted, submit } = mountInput(kind);
    for (const value of ["1234,50", "1234.50"]) {
      edit(input, value);
      expect(input.value).toBe("1234.50");
      submit();
      expect(submitted).toHaveBeenLastCalledWith(1234.5);
    }
    for (const value of [
      "1,234.50",
      "1.234,50",
      "1,,2",
      "12.345",
      "-12",
      "1e3",
    ]) {
      edit(input, value);
      expect(input.value).toBe("1234.50");
    }
  });

  test.each([0, 6])("respects %s fractional digits", (decimals) => {
    const { input } = mountInput(kind, decimals);
    const expectedDecimals = kind === "wallet" ? 2 : decimals;
    for (const character of "12,1234567") type(input, character);
    expect(input.value).toBe(`12.${"1234567".slice(0, expectedDecimals)}`);
  });
});

function mountInput(kind: "amount" | "fiat" | "wallet", decimals = 2) {
  const submitted = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      kind === "amount"
        ? createElement(AmountInput, {
            decimals,
            minimum: 0.01,
            maximum: 10000000,
            onSubmit: (amount) => submitted(amount),
          })
        : createElement(TokenAmountEntry, {
            token: { ...token, displayDecimals: decimals },
            minimumUsd: 0.01,
            maximumUsd: 10000000,
            nativeDisplay: { kind: "prefix", symbol: "CA$" },
            initialMode: kind === "fiat" ? "native" : "usd",
            platform: "mobile",
            baseUrl: "",
            onContinue: (value) =>
              submitted(kind === "fiat" ? value.nativeAmount : value.amountUsd),
          }),
    ),
  );
  const input = container.querySelector("input");
  if (!input) throw new Error("missing amount input");
  return {
    input,
    submitted,
    submit: () =>
      act(() =>
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
      ),
  };
}

function edit(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("missing input setter");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function type(input: HTMLInputElement, character: string) {
  edit(input, input.value + character);
}
