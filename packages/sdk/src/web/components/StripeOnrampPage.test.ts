import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { StripeOnrampPage } from "./StripeOnrampPage.js";

test("waiting copy names Card, not Stripe", () => {
  const html = renderToStaticMarkup(
    createElement(StripeOnrampPage, {
      node: {
        type: "Stripe",
        id: "Stripe",
        title: "Pay with Card",
        label: "Card",
        minimumUsd: 1,
        maximumUsd: 10000,
      },
      platform: "desktop",
      amountUsd: 25,
      redirectUrl: "https://example.com/onramp",
      onBack: () => {},
      baseUrl: "",
    }),
  );

  expect(html).toContain("Pay with Card");
  expect(html).toContain("with Card");
  expect(html).not.toContain("Stripe");
});
