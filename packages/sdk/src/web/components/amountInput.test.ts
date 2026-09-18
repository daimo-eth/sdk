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
  test.each(["en-US", "de-DE"])(
    "accepts either decimal key in %s",
    (locale) => {
      setLocale(locale);
      const { input, submitted, submit } = mountInput(kind);
      for (const separator of [",", "."]) {
        edit(input, "");
        for (const character of `12${separator}50`) type(input, character);
        expect(input.value).toBe(locale === "en-US" ? "12.50" : "12,50");
        submit();
        expect(submitted).toHaveBeenLastCalledWith(12.5);
      }
    },
  );

  test.each(["en-US", "de-DE"])(
    "keeps generated grouping while typing and deleting in %s",
    (locale) => {
      setLocale(locale);
      const { input, submitted, submit } = mountInput(kind);
      const decimal = locale === "en-US" ? "." : ",";
      const group = locale === "en-US" ? "," : ".";
      for (const character of `1234${group}50`) type(input, character);
      expect(input.value).toBe(`1${group}234${decimal}50`);
      submit();
      expect(submitted).toHaveBeenLastCalledWith(1234.5);
      edit(input, input.value.slice(0, -1));
      edit(input, input.value.slice(0, -1));
      expect(input.value).toBe(`1${group}234${decimal}`);
      edit(input, input.value.slice(0, -1));
      expect(input.value).toBe(`1${group}234`);
      type(input, group);
      type(input, "2");
      submit();
      expect(submitted).toHaveBeenLastCalledWith(1234.2);
      edit(input, "");
      type(input, group);
      type(input, "5");
      submit();
      expect(submitted).toHaveBeenLastCalledWith(0.5);
    },
  );

  test.each(["en-US", "de-DE"])(
    "pastes either format and rejects ambiguous or malformed input in %s",
    (locale) => {
      setLocale(locale);
      const { input, submitted, submit } = mountInput(kind);
      for (const value of ["12,50", "12.50", "1,234.50", "1.234,50"]) {
        paste(input, value);
        submit();
        expect(submitted).toHaveBeenLastCalledWith(
          value.length > 5 ? 1234.5 : 12.5,
        );
      }
      const before = input.value;
      for (const value of [
        "1,234",
        "1.234",
        "1,,2",
        "12,34.50",
        "1.23.456",
        "12.3456",
        "-12",
        "1e3",
        "",
      ]) {
        paste(input, value);
        expect(input.value).toBe(before);
      }
    },
  );

  test("accepts Indian grouping in a dollar amount", () => {
    setLocale("en-IN");
    const { input, submitted, submit } = mountInput(kind);
    paste(input, "12,34,567.89");
    submit();
    expect(submitted).toHaveBeenLastCalledWith(1234567.89);
  });

  test("pastes into a selection without reinterpreting existing grouping", () => {
    const { input, submitted, submit } = mountInput(kind);
    paste(input, "1,234.50");
    paste(input, "9", 2, 3);
    expect(input.value).toBe("1,934.50");
    paste(input, "25", 6, 8);
    expect(input.value).toBe("1,934.25");
    submit();
    expect(submitted).toHaveBeenLastCalledWith(1934.25);
  });

  test.each([0, 6])("respects %s configured fractional digits", (decimals) => {
    const { input } = mountInput(kind, decimals);
    const expectedDecimals = kind === "wallet" ? 2 : decimals;
    for (const character of "12,1234567") type(input, character);
    expect(input.value).toBe(`12.${"1234567".slice(0, expectedDecimals)}`);
    paste(input, "12.1234567");
    expect(input.value).toBe(`12.${"1234567".slice(0, expectedDecimals)}`);
  });

  test("enforces decimal limits and rejects a second separator", () => {
    const { input } = mountInput(kind);
    for (const character of "12,50") type(input, character);
    for (const character of ["1", ",", ".", "e", "-"]) {
      type(input, character);
      expect(input.value).toBe("12.50");
    }
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

function paste(
  input: HTMLInputElement,
  value: string,
  start = 0,
  end = input.value.length,
) {
  input.setSelectionRange(start, end);
  const clipboardData = new DataTransfer();
  clipboardData.setData("text", value);
  act(() =>
    input.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
}
