// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { CoinbaseWidgetErrorData } from "../../../common/api.js";
import { useCoinbaseApplePayWidget } from "./useCoinbaseApplePayWidget.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let container: HTMLDivElement;
const report = vi.fn<(event: CoinbaseWidgetErrorData) => void>();
const refresh = vi.fn(async () => {});
const error = {
  eventName: "onramp_api.commit_error",
  data: {
    errorCode: "ERROR_CODE_GUEST_CARD_SOFT_DECLINED",
    errorMessage: "Card declined",
    secret: "omit me",
  },
};

function Harness({ orderId }: { orderId?: string }) {
  const state = useCoinbaseApplePayWidget({
    allowExpandedView: true,
    paymentLinkUrl: `https://pay.coinbase.com/${orderId ?? "legacy"}`,
    providerOrderId: orderId,
    onWidgetError: report,
    onRefreshDeposit: refresh,
  });
  return createElement(
    "div",
    null,
    createElement("iframe", { key: orderId, ref: state.iframeRef }),
    createElement("span", null, state.widgetError),
  );
}
function mount(orderId: string | undefined = "order-one") {
  if (!root) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  act(() => root?.render(createElement(Harness, { orderId })));
  const source = container.querySelector("iframe")?.contentWindow;
  if (!source) throw new Error("missing iframe");
  return source;
}
function send(
  data: unknown = error,
  origin = "https://pay.coinbase.com",
  source: MessageEventSource | null = container.querySelector("iframe")!
    .contentWindow,
) {
  act(() =>
    window.dispatchEvent(new MessageEvent("message", { data, origin, source })),
  );
}
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.resetAllMocks();
});

it("reports only safe error fields for the current order and preserves the visible error", () => {
  mount();
  send(JSON.stringify(error));
  expect(report).toHaveBeenCalledExactlyOnceWith({
    providerOrderId: "order-one",
    eventName: error.eventName,
    errorCode: error.data.errorCode,
  });
  expect(container.textContent).toBe("Card declined");
  send();
  expect(report).toHaveBeenCalledTimes(1);
});

it("ignores untrusted origins, unrelated windows, stale iframes, and malformed messages", () => {
  const oldSource = mount();
  for (const origin of [
    "http://pay.coinbase.com",
    "https://coinbase.com.evil.test",
    "null",
  ])
    send(error, origin);
  send(error, "https://pay.coinbase.com", window);
  send(error, "https://pay.coinbase.com", null);
  for (const data of ["{", null, [], { eventName: 5 }, { eventName: "other" }])
    send(data);
  mount("order-two");
  send(error, "https://pay.coinbase.com", oldSource);
  expect(report).not.toHaveBeenCalled();
  send();
  expect(report).toHaveBeenCalledExactlyOnceWith({
    providerOrderId: "order-two",
    eventName: error.eventName,
    errorCode: error.data.errorCode,
  });
});

it("bounds distinct errors and resets the budget for the next order", () => {
  mount();
  for (let i = 0; i < 20; i++)
    send({ ...error, data: { errorCode: `ERROR_CODE_NEW_${i}` } });
  expect(report).toHaveBeenCalledTimes(10);
  mount("order-two");
  send();
  expect(report).toHaveBeenCalledTimes(11);
});

it("supports missing codes and documented codes without the ERROR_CODE prefix", () => {
  mount();
  send({ eventName: "onramp_api.load_error" });
  send({
    eventName: "onramp_api.load_error",
    data: { errorCode: "ASSET_NOT_TRADABLE" },
  });
  expect(report.mock.calls.map(([event]) => event.errorCode)).toEqual([
    null,
    "ASSET_NOT_TRADABLE",
  ]);
  send({ ...error, data: { errorCode: "not a code or safe field" } });
  expect(report).toHaveBeenCalledTimes(2);
});

it("keeps the payment UI working when diagnostics fail or the server supplies no order ID", () => {
  mount();
  report.mockImplementation(() => {
    throw new Error("offline");
  });
  send();
  expect(container.textContent).toBe("Card declined");
  send({ eventName: "onramp_api.commit_success" });
  expect(refresh).toHaveBeenCalledOnce();
  expect(report).toHaveBeenCalledOnce();
  act(() => root?.render(createElement(Harness, {})));
  send();
  expect(container.textContent).toBe("Card declined");
  expect(report).toHaveBeenCalledOnce();
});
