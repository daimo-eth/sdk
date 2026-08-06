import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test } from "vitest";

import { setLocale } from "../hooks/locale.js";
import { getAmountAfterFee, SelectAmountPage } from "./SelectAmountPage.js";

beforeEach(() => setLocale("en"));

test("subtracts the configured fee without displaying a negative amount", () => {
  expect(getAmountAfterFee(5, 1)).toBe(4);
  expect(getAmountAfterFee(0, 1)).toBe(0);
});

test("shows fee rows only when a flat fee is configured", () => {
  const commonProps = {
    node: { title: "Lemon" },
    minimum: 5,
    maximum: 1_000,
    onContinue: () => {},
    baseUrl: "",
  };
  const withFee = renderToStaticMarkup(
    createElement(SelectAmountPage, { ...commonProps, flatFeeUsd: 1 }),
  );
  const withoutFee = renderToStaticMarkup(
    createElement(SelectAmountPage, commonProps),
  );

  expect(withFee).toContain("Fee");
  expect(withFee).toContain("You receive");
  expect(withFee).toContain("$1.00");
  expect(withFee).toContain("$0.00");
  expect(withoutFee).not.toContain("You receive");
});
