import { describe, expect, test } from "vitest";

import { zPaymentAction, zPaymentMethodCategory } from "./paymentMethod.js";

describe("payment method contract", () => {
  test("keeps product category separate from execution action", () => {
    expect(zPaymentMethodCategory.parse("onramp")).toBe("onramp");
    expect(
      zPaymentAction.parse({
        type: "openUrl",
        url: "https://example.com/pay",
        presentation: "popup",
        waitingMessage: "finish your payment",
      }),
    ).toMatchObject({ type: "openUrl" });
    expect(
      zPaymentAction.parse({
        type: "embeddedWidget",
        sdk: "stripeOnramp",
        clientSecret: "secret",
        publishableKey: "key",
        fallbackUrl: "https://example.com/pay",
      }),
    ).toMatchObject({ type: "embeddedWidget" });
  });
});
