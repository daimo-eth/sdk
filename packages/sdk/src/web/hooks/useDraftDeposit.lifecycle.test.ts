// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createDaimoClient } from "../../client/createDaimoClient.js";
import type { AccountRail } from "../../common/account.js";
import {
  AccountFlowContext,
  type AccountFlowState,
  useAccountFlowState,
} from "./useAccountFlow.js";
import { useDraftDeposit } from "./useDraftDeposit.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
const fetchImpl = vi.fn<typeof fetch>();
const client = createDaimoClient({ baseUrl: "https://api.test", fetchImpl });
const getAccessToken = async () => "test-token";
let flow: AccountFlowState;

function Harness({
  rail,
  amount,
  visible,
}: {
  rail: AccountRail;
  amount: string;
  visible: boolean;
}) {
  const state = useAccountFlowState();
  flow = { ...state, getAccessToken };
  return createElement(
    AccountFlowContext.Provider,
    { value: flow },
    visible ? createElement(Draft, { rail, amount }) : null,
  );
}
function Draft({ rail, amount }: { rail: AccountRail; amount: string }) {
  const result = useDraftDeposit({
    client,
    accountFlow: flow,
    sessionId: "session-1",
    rail,
    depositAmount: amount,
    enabled: true,
    draftMode: "plain",
  });
  return createElement(
    "div",
    null,
    JSON.stringify({ payment: result.payment, error: result.error }),
  );
}
function response(rail: string) {
  return Response.json({
    deposit: { id: `deposit-${rail}` },
    payment: {
      flow: "wallet-pay-widget",
      paymentLinkKind: rail,
      paymentLinkUrl: `https://pay.coinbase.com/${rail}`,
    },
  });
}
async function render(rail: AccountRail, amount = "25", visible = true) {
  await act(async () =>
    root.render(createElement(Harness, { rail, amount, visible })),
  );
}
async function debounce() {
  await act(async () => vi.advanceTimersByTimeAsync(350));
}
beforeEach(() => {
  vi.useFakeTimers();
  fetchImpl.mockImplementation(async (_input, init) =>
    response(JSON.parse(String(init?.body)).rail),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.resetAllMocks();
});

test.each([
  ["apple_pay", "google_pay"],
  ["google_pay", "apple_pay"],
] as const)(
  "replaces a %s draft with %s at the same amount",
  async (first, second) => {
    await render(first);
    await debounce();
    expect(container.textContent).toContain(
      `https://pay.coinbase.com/${first}`,
    );
    await render(second);
    expect(container.textContent).not.toContain(
      `https://pay.coinbase.com/${first}`,
    );
    await debounce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain(
      `https://pay.coinbase.com/${second}`,
    );
    expect(flow.getDepositState("session-1")).toMatchObject({
      rail: second,
      kind: "drafted",
    });
  },
);

test("reuses the same rail and amount across back navigation, but redrafts a changed amount", async () => {
  await render("google_pay");
  await debounce();
  await render("google_pay", "25", false);
  await render("google_pay");
  await debounce();
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  await render("google_pay", "30");
  await debounce();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(flow.getDepositState("session-1")).toMatchObject({
    rail: "google_pay",
    depositAmount: "30",
  });
});

test.each(["success", "failure"] as const)(
  "ignores late %s from the prior rail",
  async (outcome) => {
    let finish!: () => void;
    fetchImpl.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve, reject) => {
          finish = () =>
            outcome === "success"
              ? resolve(response("apple_pay"))
              : reject(new Error("old order failed"));
        }),
    );
    await render("apple_pay");
    await debounce();
    await render("google_pay");
    await debounce();
    await act(async () => finish());
    expect(container.textContent).toContain(
      "https://pay.coinbase.com/google_pay",
    );
    expect(container.textContent).not.toContain("old order failed");
    expect(flow.getDepositState("session-1")).toMatchObject({
      rail: "google_pay",
      kind: "drafted",
    });
  },
);

test("restarts a draft interrupted by navigation and ignores its old response", async () => {
  let finish!: () => void;
  fetchImpl.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = () => resolve(response("stale-order"));
      }),
  );
  await render("google_pay");
  await debounce();
  await render("google_pay", "25", false);
  await render("google_pay");
  await debounce();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  await act(async () => finish());
  expect(container.textContent).toContain(
    "https://pay.coinbase.com/google_pay",
  );
  expect(container.textContent).not.toContain("stale-order");
});
