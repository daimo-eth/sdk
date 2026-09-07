// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { createDaimoClient } from "../../client/createDaimoClient.js";
import type { SessionWithNav } from "../api/navTree.js";
import { FiatUnavailablePage } from "../components/account/FiatUnavailablePage.js";
import { useSessionNav } from "./useSessionNav.js";
import { setLocale } from "./locale.js";

const { getDeposit } = vi.hoisted(() => ({ getDeposit: vi.fn() }));
vi.mock("./DaimoClientContext.js", () => ({ useDaimoClient: () => client }));
const client = createDaimoClient({
  baseUrl: "https://example.test",
  fetchImpl: async () => new Response("{}"),
});
client.account.getDeposit = getDeposit;
const session: SessionWithNav = {
  sessionId: "pause-session",
  clientSecret: "secret",
  status: "requires_payment_method",
  destination: {
    type: "evm",
    address: "0x1234567890123456789012345678901234567890",
    chainId: 8453,
    chainName: "base",
    tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    tokenSymbol: "USDC",
  },
  display: { title: "Deposit", verb: "Deposit" },
  paymentMethod: null,
  createdAt: 1,
  expiresAt: 9999999999,
  baseUrl: "https://example.test",
  navTree: [
    {
      type: "ChooseOption",
      id: "SelectMethod",
      title: "Deposit",
      options: [
        {
          type: "Fiat",
          id: "sepa",
          title: "SEPA",
          fiatMethod: "sepa",
          temporarilyUnavailable: true,
        },
        { type: "ConnectedWallet", id: "wallet", title: "Wallet" },
      ],
    },
  ],
};
let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
});

function Harness() {
  const [current, setCurrent] = useState(session);
  const nav = useSessionNav(current, setCurrent, true, null);
  if (nav.topEntry?.type === "account-unavailable")
    return createElement(FiatUnavailablePage, { onBack: nav.handleBack });
  if (nav.topEntry) return createElement("p", null, nav.topEntry.type);
  return createElement(
    "button",
    { onClick: () => nav.handleNavigate("sepa") },
    "SEPA",
  );
}

async function mountAndSelect() {
  setLocale("en");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(Harness));
  });
  await act(async () => {
    container.querySelector("button")!.click();
  });
  return container;
}

test("paused SEPA is clickable, shows the message before auth, and returns to the picker", async () => {
  getDeposit.mockResolvedValue({ deposit: null });
  const container = await mountAndSelect();
  expect(container.textContent).toContain("Temporarily unavailable");
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "choose another payment method",
  );
  const back = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Choose another payment method",
  );
  expect(back).toBeDefined();
  await act(async () => back!.click());
  expect(container.textContent).toBe("SEPA");
});

test("a deposit past payment resumes its status during a pause", async () => {
  getDeposit.mockResolvedValue({ deposit: { status: "payment_received" } });
  const container = await mountAndSelect();
  expect(container.textContent).toBe("account-status");
});
