// @vitest-environment happy-dom

import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type {
  AccountDeposit,
  AccountDepositStatus,
} from "../../../common/account.js";
import type { SessionWithNav } from "../../api/navTree.js";
import { setLocale, t } from "../../hooks/locale.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { DaimoModal } from "../DaimoModal.js";
import { openDeeplink } from "./openDeeplink.js";

const state = vi.hoisted(() => ({
  authenticated: true,
  initialPage: "account-loading" as
    | "account-loading"
    | "account-institution-review",
  retrieve: vi.fn(),
}));
const session: SessionWithNav = {
  sessionId: "test-session",
  clientSecret: "test-secret",
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
  expiresAt: 2_000_000_000,
  navTree: [
    {
      id: "interac",
      type: "Fiat",
      fiatMethod: "interac",
      title: "Interac",
      paymentInteraction: "bank-picker",
    },
  ],
  baseUrl: "https://pay.example.test",
};
const payment = {
  flow: "bank-picker",
  currency: { code: "CAD", symbol: "CA$" },
  qrUrl: "https://bank.example.test/pay",
  institutions: [],
};

vi.mock("../../hooks/DaimoClientContext.js", () => ({
  useDaimoClient: () => ({
    internal: { sessions: { retrieveWithNav: state.retrieve } },
  }),
}));
vi.mock("../../hooks/useAccountFlow.js", () => ({
  useAccountFlow: () => ({ isAuthenticated: state.authenticated }),
  useSessionDepositState: () => ({
    depositState: { kind: "started", depositAmount: "25.00", payment },
  }),
}));
vi.mock("./AccountFlowProvider.js", () => ({
  AccountFlowProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../hooks/useSessionPolling.js", () => ({
  useSessionPolling: (initial: SessionWithNav) => ({
    session: initial,
    setSession: vi.fn(),
  }),
}));
vi.mock("../../hooks/useDepositAddress.js", () => ({
  useDepositAddress: () => ({ address: null }),
}));
vi.mock("../../hooks/useInjectedWallets.js", () => ({
  useInjectedWallets: () => ({ wallets: [], isLoading: false }),
}));
vi.mock("../../hooks/useWalletFlow.js", () => ({
  useWalletFlow: () => ({ connectedAddress: null }),
}));
vi.mock("../../hooks/usePaymentCallbacks.js", () => ({
  usePaymentCallbacks: vi.fn(),
}));
vi.mock("../../hooks/navEvent.js", () => ({ createNavLogger: () => vi.fn() }));
vi.mock("../../hooks/useDepositPoller.js", () => ({
  useDepositPoller: vi.fn(),
}));
vi.mock("./openDeeplink.js", () => ({ openDeeplink: vi.fn() }));
vi.mock("../../hooks/useSessionNav.js", () => ({
  useSessionNav: () => {
    const [page, setPage] = useState<{
      type:
        | "account-loading"
        | "account-institution-review"
        | "account-deeplink"
        | "account-status";
      initialStatus?: AccountDepositStatus;
    }>({ type: state.initialPage });
    return {
      topEntry: {
        ...page,
        nodeId: "interac",
        rail: "interac",
        paymentInteraction: "bank-picker",
      },
      canGoBack: true,
      handleReset: vi.fn(),
      handleBack: vi.fn(),
      getNodeCtx: () => ({ nodeId: "interac", nodeType: "Fiat" }),
      handleAccountAdvance: (
        type: typeof page.type,
        options?: { initialStatus?: AccountDepositStatus },
      ) => setPage({ type, ...options }),
    };
  },
}));

let root: Root | null = null;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  setLocale("en");
  state.authenticated = true;
  state.initialPage = "account-loading";
  state.retrieve.mockResolvedValue({ session });
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  vi.clearAllMocks();
});

test.each([true, false])(
  "shows the amount skeleton immediately during account lookup (embedded=%s)",
  async (embedded) => {
    const container = await mount(embedded);
    expect(container.textContent).toContain(t.accountPayment);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    const button = findButton(container, t.continue);
    expect(button.disabled).toBe(true);
    expect(button.closest('[style*="display: none"]')).toBeNull();
    expect(container.querySelector("input")).toBeNull();
  },
);

test("shows a form skeleton for a signed-out user", async () => {
  state.authenticated = false;
  const container = await mount();
  expect(container.textContent).toContain("Interac");
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(container.textContent).not.toContain(t.accountPayment);
});

test("opening Interac shows a waiting state and a secondary reopen action", async () => {
  state.initialPage = "account-institution-review";
  const container = await mount();
  act(() => findButton(container, t.accountInteracConfirmOpenInterac).click());
  expect(openDeeplink).toHaveBeenCalledWith(
    { type: "redirect", url: payment.qrUrl },
    "mobile",
    { newWindow: true },
  );
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    t.waitingForYourPayment,
  );
  expect(container.textContent).toContain("PayTrie AB Inc");
  const reopen = findButton(container, t.reopenPayment);
  expect(reopen.classList.contains("daimo-w-full")).toBe(false);
  act(() => reopen.click());
  expect(openDeeplink).toHaveBeenCalledTimes(2);
  updateDeposit("awaiting_payment");
  expect(container.textContent).toContain(t.waitingForYourPayment);
});

test("processing shows its ETA without a fast spinner and keeps the success state", async () => {
  state.initialPage = "account-institution-review";
  const container = await mount();
  act(() => findButton(container, t.accountInteracConfirmOpenInterac).click());
  updateDeposit("payment_received");
  updateDeposit("payment_received");
  expect(container.textContent).toContain("ETA 5–30 min");
  expect(container.textContent).toContain(t.depositDetected);
  expect(container.querySelector('[style*="daimo-spin"]')).toBeNull();
  updateDeposit("token_delivered");
  expect(container.textContent).toContain("ETA <1 min");
  expect(container.querySelector('[style*="daimo-spin"]')).toBeNull();
  updateDeposit("completed");
  expect(container.textContent).toContain(t.accountDepositComplete);
  expect(container.textContent).not.toContain("ETA");
  expect(
    container.querySelector('[style*="var(--daimo-checkmark)"]'),
  ).not.toBeNull();
});

test.each(["failed", "expired", "completed"] as const)(
  "carries %s into the status page without a false received state",
  async (status) => {
    state.initialPage = "account-institution-review";
    const container = await mount();
    act(() =>
      findButton(container, t.accountInteracConfirmOpenInterac).click(),
    );
    updateDeposit(status);
    expect(container.textContent).not.toContain(t.accountDepositReceived);
    expect(container.textContent).toContain(
      status === "completed" ? t.accountDepositComplete : t.errorDepositFailed,
    );
  },
);

async function mount(embedded = true) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      createElement(DaimoModal, {
        sessionId: session.sessionId,
        clientSecret: session.clientSecret,
        embedded,
        platform: "mobile",
      }),
    ),
  );
  return container;
}
function findButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === label,
  );
  if (!button) throw new Error(`missing button: ${label}`);
  return button;
}
function updateDeposit(status: AccountDepositStatus) {
  const options = vi.mocked(useDepositPoller).mock.lastCall?.[0];
  if (!options) throw new Error("missing deposit poller");
  const deposit: AccountDeposit = {
    id: "deposit",
    sessionId: session.sessionId,
    fiatAmount: "25.00",
    fiatCurrency: "CAD",
    status,
    errorMessage: null,
    eta: { payment: "5–30 min", finalizing: "<1 min" },
  };
  act(() => options.onUpdate(deposit));
}
