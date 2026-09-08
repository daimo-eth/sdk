// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createDaimoClient } from "../../client/createDaimoClient.js";
import type { SessionWithNav } from "../api/navTree.js";
import { FiatUnavailablePage } from "../components/account/FiatUnavailablePage.js";
import { useSessionNav } from "./useSessionNav.js";
import { findNode } from "./types.js";
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
beforeEach(() => getDeposit.mockReset());
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
});

type HarnessProps = { initialSession?: SessionWithNav; startNodeId?: string };

function Harness({ initialSession = session, startNodeId }: HarnessProps) {
  const [current, setCurrent] = useState(initialSession);
  const nav = useSessionNav(
    current,
    setCurrent,
    true,
    null,
    undefined,
    undefined,
    undefined,
    { startNodeId },
  );
  if (nav.topEntry?.type === "account-unavailable")
    return createElement(FiatUnavailablePage, {
      onBack: nav.canGoBack ? nav.handleBack : undefined,
    });
  if (nav.topEntry && nav.topEntry.type !== "choose-option")
    return createElement(
      "p",
      { "data-can-go-back": nav.canGoBack },
      nav.topEntry.type,
    );
  const picker = nav.topEntry
    ? findNode(nav.topEntry.nodeId, current.navTree)
    : current.navTree[0];
  if (picker?.type !== "ChooseOption") return null;
  return createElement(
    "div",
    { "data-page": "picker" },
    picker.options.map((node) =>
      createElement(
        "button",
        { key: node.id, onClick: () => nav.handleNavigate(node.id) },
        node.title,
      ),
    ),
  );
}

async function mount(props: HarnessProps = {}) {
  setLocale("en");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(Harness, props));
  });
  return container;
}

async function mountAndSelect() {
  const container = await mount();
  await act(async () => {
    container.querySelector("button")!.click();
  });
  return container;
}

function autoSession(
  mode: "single-option" | "popup-deep-link" | "nested-picker",
): SessionWithNav {
  const picker = session.navTree[0];
  if (picker.type !== "ChooseOption") throw new Error("expected picker");
  if (mode === "popup-deep-link") return session;
  const options =
    mode === "single-option"
      ? picker.options.slice(0, 1)
      : [
          {
            ...picker,
            id: "bank",
            title: "Bank",
            options: picker.options.slice(0, 1),
          },
        ];
  return { ...session, navTree: [{ ...picker, options }] };
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
  expect(container.querySelector('[data-page="picker"]')).not.toBeNull();
});

test("a deposit past payment resumes its status during a pause", async () => {
  getDeposit.mockResolvedValue({ deposit: { status: "payment_received" } });
  const container = await mountAndSelect();
  expect(container.textContent).toBe("account-status");
});

test.each(["single-option", "popup-deep-link", "nested-picker"] as const)(
  "auto-opened paused method returns to a picker without reopening: %s",
  async (mode) => {
    getDeposit.mockResolvedValue({ deposit: null });
    const container = await mount({
      initialSession: autoSession(mode),
      startNodeId: mode === "popup-deep-link" ? "sepa" : undefined,
    });
    expect(container.textContent).toContain("Temporarily unavailable");
    const back = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Choose another payment method",
    );
    expect(back).toBeDefined();
    await act(async () => {
      back!.click();
    });
    expect(container.querySelector('[data-page="picker"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Temporarily unavailable");
    expect(getDeposit).toHaveBeenCalledTimes(1);
  },
);

test("automatic status navigation keeps its existing back behavior", async () => {
  getDeposit.mockResolvedValue({ deposit: { status: "payment_received" } });
  const container = await mount({
    initialSession: autoSession("single-option"),
  });
  expect(container.textContent).toBe("account-status");
  expect(container.querySelector('[data-can-go-back="false"]')).not.toBeNull();
});
