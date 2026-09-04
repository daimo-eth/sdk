// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { setLocale, t } from "../../hooks/locale.js";
import { AccountAmountPage } from "./AccountPaymentPage.js";

const { client, account, depositState, startBankDeposit } = vi.hoisted(() => ({
  client: { account: { getDepositConstraints: vi.fn() } },
  account: { isAuthenticated: true, getAccessToken: vi.fn(async () => "test") },
  depositState: { depositState: null, setDepositState: vi.fn() },
  startBankDeposit: vi.fn(),
}));
vi.mock("../../hooks/DaimoClientContext.js", () => ({
  useDaimoClient: () => client,
}));
vi.mock("../../hooks/useAccountFlow.js", () => ({
  useAccountFlow: () => account,
  useSessionDepositState: () => depositState,
}));
vi.mock("../../hooks/useDraftDeposit.js", () => ({ startBankDeposit }));

let root: Root | null = null;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  vi.clearAllMocks();
});

it("keeps a deposit start failure visible until the amount changes", async () => {
  setLocale("en");
  client.account.getDepositConstraints.mockResolvedValue({
    currency: { code: "CAD", symbol: "CA$" },
    amountRange: { min: "10", max: "1000" },
    destinationToken: {
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
    },
    icon: { logoURI: "/flag.svg", alt: "CAD" },
    badge: { logoURI: "/bank.svg", alt: "Bank" },
  });
  startBankDeposit.mockRejectedValue(new Error("test provider failure"));
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      createElement(AccountAmountPage, {
        rail: "interac",
        paymentInteraction: "bank-picker",
        sessionId: "test",
        platform: "mobile",
        baseUrl: "",
        startDepositOnAdvance: true,
        onAdvance: vi.fn(),
      }),
    ),
  );
  const input = container.querySelector("input");
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!input || !setter) throw new Error("missing amount input");
  act(() => {
    setter.call(input, "100");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const button = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === t.continue,
  );
  if (!button) throw new Error("missing continue button");
  await act(async () => button.click());
  expect(startBankDeposit).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("test provider failure");
  act(() => {
    setter.call(input, "101");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent).not.toContain("test provider failure");
});
