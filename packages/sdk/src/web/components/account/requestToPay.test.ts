import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { baseUSDC } from "../../../common/token.js";
import type { DepositPaymentInfo } from "../../../common/account.js";
import {
  getAuthorizedRoutingAmount,
  getRequestToPayContract,
  isExpiredRequestToPay,
} from "./accountPaymentCompatibility.js";
import {
  formatFiatAmount,
  RequestToPayActiveContent,
  RequestToPayExpiredContent,
} from "./AccountRequestToPayPage.js";

const PAYMENT = {
  flow: "request-to-pay",
  currency: { code: "BRL", symbol: "R$" },
  minAmount: "10.00",
  maxAmount: "50000.00",
  destinationToken: {
    ...baseUSDC,
    usd: 1,
    priceFromUsd: 1,
    maxAcceptUsd: 1_000_000,
    maxSendUsd: 1_000_000,
    displayDecimals: 2,
  },
  icon: { logoURI: "/flags/br.svg", alt: "Brazil" },
  badge: { logoURI: "/rails/request.svg", alt: "Request to pay" },
  instructions: "Scan the QR code or copy the payment code.",
  ui: {
    title: "Pay exact request",
    codeLabel: "Exact amount",
    actionLabel: "Copy payment code",
    actionCompletedLabel: "Payment code copied",
    expiredTitle: "Request expired",
    expiredInstructions: "Create a new request to continue.",
    retryLabel: "Create new request",
    retryingLabel: "Creating request",
  },
  payableAmount: "105.25",
  paymentCode: "synthetic-opaque-payment-code",
  expiresAt: 1_800_000_000,
  expectedSettlementAmount: "100.00",
  retry: { type: "recreate-session" },
} as const satisfies DepositPaymentInfo;

describe("request-to-pay contract", () => {
  test("keeps exact fiat F distinct from authorized settlement S", () => {
    const contract = getRequestToPayContract(PAYMENT);
    expect(contract?.payableAmount).toBe("105.25");
    expect(contract?.expectedSettlementAmount).toBe("100.00");
    expect(getAuthorizedRoutingAmount(PAYMENT, "105.25")).toBe("100.00");
    expect(formatFiatAmount("105.25", "BRL", "R$", "en-US")).toContain(
      "105.25",
    );
  });

  test("exposes only semantic QR, copy, expiry, and retry data", () => {
    const contract = getRequestToPayContract(PAYMENT);
    expect(contract).toMatchObject({
      flow: "request-to-pay",
      paymentCode: "synthetic-opaque-payment-code",
      expiresAt: 1_800_000_000,
      retry: { type: "recreate-session" },
      ui: {
        actionLabel: "Copy payment code",
        expiredTitle: "Request expired",
        retryLabel: "Create new request",
      },
    });
  });

  test("renders QR/copy plus accessible fiat and settlement amounts", () => {
    const html = renderToStaticMarkup(
      createElement(RequestToPayActiveContent, {
        payment: PAYMENT,
        remainingS: 90,
      }),
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Exact amount QR code"');
    expect(html).toContain("105.25");
    expect(html).toContain("100.00 USDC");
    expect(html).toContain("Copy payment code");
    expect(html).toContain('aria-live="polite"');
  });

  test("uses the shared QR motion classes covered by reduced-motion CSS", () => {
    const html = renderToStaticMarkup(
      createElement(RequestToPayActiveContent, {
        payment: PAYMENT,
        remainingS: 90,
      }),
    );
    const css = readFileSync(
      new URL("../../base.css", import.meta.url),
      "utf8",
    );
    expect(html).toContain("daimo-qr-fade-in");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.daimo-qr-fade-in,[\s\S]*?animation: none;/,
    );
  });

  test("announces expiry and removes stale QR/copy affordances", () => {
    const html = renderToStaticMarkup(
      createElement(RequestToPayExpiredContent, {
        payment: PAYMENT,
        isRetrying: false,
        retryError: null,
        onRetry: () => undefined,
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("Create a new request to continue.");
    expect(html).toContain("Create new request");
    expect(html).not.toContain(PAYMENT.paymentCode);
    expect(html).not.toContain("Copy payment code");
  });

  test("accepts a past absolute expiry for immediate expired rendering", () => {
    const expired = { ...PAYMENT, expiresAt: 1 } as DepositPaymentInfo;
    expect(getRequestToPayContract(expired)).not.toBeNull();
    expect(isExpiredRequestToPay(expired, 2)).toBe(true);
    expect(isExpiredRequestToPay(PAYMENT, PAYMENT.expiresAt - 1)).toBe(false);
  });

  test.each([
    ["empty code", { paymentCode: "" }],
    ["missing ui copy", { ui: { ...PAYMENT.ui, retryLabel: "" } }],
    ["missing instructions", { instructions: "" }],
    ["invalid fiat amount", { payableAmount: "NaN" }],
    ["invalid settlement amount", { expectedSettlementAmount: "0" }],
    ["missing expiry", { expiresAt: 0 }],
    ["fractional expiry", { expiresAt: 1_800_000_000.5 }],
    ["unknown retry", { retry: { type: "reload" } }],
  ])("fails closed for %s", (_label, override) => {
    const malformed = { ...PAYMENT, ...override } as DepositPaymentInfo;
    expect(getRequestToPayContract(malformed)).toBeNull();
    expect(() => getAuthorizedRoutingAmount(malformed, "105.25")).toThrow(
      "invalid request-to-pay payment info",
    );
  });
});
