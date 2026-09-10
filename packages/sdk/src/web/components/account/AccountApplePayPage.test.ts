// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { DepositPaymentInfo } from "../../../common/account.js";
import type { DaimoClient } from "../../../client/createDaimoClient.js";
import { createDaimoClient } from "../../../client/createDaimoClient.js";
import { AccountWalletPayPage } from "./AccountApplePayPage.js";

const { context, draft } = vi.hoisted(() => ({
  context: { client: undefined as DaimoClient | undefined },
  draft: {
    payment: {
      flow: "wallet-pay-widget",
      paymentLinkUrl: "https://pay.coinbase.com/test",
      providerOrderId: "order-page",
      paymentLinkKind: "apple_pay",
      paymentTotal: "5",
      totalFeeUnits: "0",
      purchaseAmount: "5",
      instructions: "Pay with Apple Pay",
      currency: { code: "USD", symbol: "$" },
      amountRange: { min: "1", max: "500" },
      destinationToken: {
        chainId: 8453,
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        decimals: 6,
        logoURI: "/usdc.svg",
        logoSourceURI: "/base.svg",
        usd: 1,
        priceFromUsd: 1,
        maxAcceptUsd: 10000,
        maxSendUsd: 10000,
        displayDecimals: 2,
      },
      icon: { logoURI: "/us.svg", alt: "USD" },
      badge: { logoURI: "/apple.svg", alt: "Apple Pay" },
    } satisfies DepositPaymentInfo,
    isCreating: false,
    retry: () => {},
  },
}));
vi.mock("../../hooks/DaimoClientContext.js", () => ({
  useDaimoClient: () => context.client,
}));
vi.mock("../../hooks/useAccountFlow.js", () => ({
  useSessionDepositState: () => ({ accountFlow: null, depositState: null }),
}));
vi.mock("../../hooks/useDraftDeposit.js", () => ({
  useDraftDeposit: () => draft,
}));
vi.mock("../../hooks/useDepositPoller.js", () => ({
  useDepositPoller: () => {},
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it("sends the active widget error through the real SDK transport and survives a rejected log request", async () => {
  const fetchImpl = vi.fn<typeof fetch>(
    async () => new Response("unavailable", { status: 503 }),
  );
  context.client = createDaimoClient({
    baseUrl: "https://api.test",
    fetchImpl,
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 344, 44),
  );
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      createElement(AccountWalletPayPage, {
        rail: "apple_pay",
        paymentInteraction: "wallet-pay-widget",
        sessionId: "session-page",
        clientSecret: "test-secret",
        actionVerb: "Deposit",
        initialAmount: "5",
        onAdvance: vi.fn(),
      }),
    ),
  );
  const source = document.querySelector("iframe")?.contentWindow;
  expect(source).toBeTruthy();
  await act(async () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://pay.coinbase.com",
        source,
        data: JSON.stringify({
          eventName: "onramp_api.commit_error",
          data: {
            errorCode: "ERROR_CODE_GUEST_CARD_SOFT_DECLINED",
            errorMessage: "Card declined",
            paymentLinkUrl: "secret",
          },
        }),
      }),
    ),
  );
  expect(fetchImpl).toHaveBeenCalledOnce();
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe("https://api.test/v1/sessions/session-page/internal/nav");
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({
    clientSecret: "test-secret",
    event: "coinbase_widget_error",
    eventData: {
      nodeId: null,
      nodeType: null,
      providerOrderId: "order-page",
      eventName: "onramp_api.commit_error",
      errorCode: "ERROR_CODE_GUEST_CARD_SOFT_DECLINED",
    },
  });
  expect(container.textContent).toContain("Apple Pay unavailable");
});
