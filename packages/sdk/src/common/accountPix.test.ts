import { describe, expect, test } from "vitest";

import { zAccountRail } from "./account.js";
import { zCreatePaymentMethodRequest } from "./api.js";
import { getKnownToken, polygonBRLA } from "./token.js";

describe("pix public metadata", () => {
  test("exposes the pix account rail", () => {
    expect(zAccountRail.parse("pix")).toBe("pix");
  });

  test("accepts pix in hosted payment-method creation", () => {
    expect(
      zCreatePaymentMethodRequest.safeParse({
        clientSecret: "secret",
        paymentMethod: { type: "fiat", fiatMethod: "pix" },
      }).success,
    ).toBe(true);
  });

  test("registers polygon brla", () => {
    expect(
      getKnownToken(137, "0xE6A537a407488807F0bbeb0038B79004f19DDDFb"),
    ).toEqual(polygonBRLA);
    expect(polygonBRLA).toMatchObject({
      chainId: 137,
      decimals: 18,
      fiatISO: "BRL",
      name: "BRLA Token",
      symbol: "BRLA",
    });
  });
});
