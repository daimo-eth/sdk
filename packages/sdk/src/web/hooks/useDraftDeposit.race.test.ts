// @vitest-environment happy-dom

import { act, createElement, StrictMode, useCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { createDaimoClient } from "../../client/createDaimoClient.js";
import {
  AccountFlowContext,
  useAccountFlowState,
  type AccountFlowState,
  type DepositStateInput,
} from "./useAccountFlow.js";
import { useDraftDeposit } from "./useDraftDeposit.js";

const stateUpdates: DepositStateInput[] = [];

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
  stateUpdates.length = 0;
});

test.each([
  "amount",
  "disabled",
  "unmount",
  "session",
  "rail",
  "retry",
] as const)(
  "stops the older signed update on %s before the next debounce",
  async (change) => {
    const firstSignature = deferred<string>();
    const h = harness(firstSignature.promise);
    await h.render({ depositAmount: "5" });
    await h.tick();
    expect(h.signTypedData).toHaveBeenCalledOnce();
    if (change === "unmount") {
      await act(async () => root?.unmount());
      root = undefined;
    } else if (change === "retry") {
      await act(async () => h.current()?.retry());
    } else {
      await h.render({
        depositAmount: change === "amount" ? "500" : "5",
        enabled: change !== "disabled",
        sessionId: change === "session" ? "session-2" : "session-1",
        rail: change === "rail" ? "interac" : "apple_pay",
      });
    }
    await act(async () => firstSignature.resolve("0xold"));
    expect(h.signedRequests).toEqual([]);
    if (change === "disabled") await h.render({ depositAmount: "5" });
    if (change !== "unmount") {
      await h.tick();
      expect(h.signedRequests).toEqual([
        {
          depositAmount: change === "amount" ? "500" : "5",
          expectedProviderOrderId:
            change === "amount" ? "order-500" : "order-5",
        },
      ]);
      expect(h.current()?.error).toBeNull();
      expect(h.current()?.payment).not.toBeNull();
    }
  },
);

test("an older preview cannot start signing after the new amount is selected", async () => {
  const preview = deferred<void>();
  const h = harness(undefined, preview.promise);
  await h.render({ depositAmount: "5" });
  await h.tick();
  await h.render({ depositAmount: "500" });
  await h.tick();
  await act(async () => preview.resolve());
  expect(h.prepareAmounts).toEqual(["500"]);
  expect(h.signedRequests).toEqual([
    { depositAmount: "500", expectedProviderOrderId: "order-500" },
  ]);
});

test("an obsolete signature error cannot overwrite the selected amount", async () => {
  const signature = deferred<string>();
  const h = harness(signature.promise);
  await h.render({ depositAmount: "5" });
  await h.tick();
  await h.render({ depositAmount: "500" });
  stateUpdates.length = 0;
  await act(async () => signature.reject(new Error("old signature failed")));
  expect(stateUpdates.filter((state) => state.depositAmount === "5")).toEqual(
    [],
  );
  expect(h.current()?.error).toBeNull();
  await h.tick();
  expect(h.signedRequests).toEqual([
    { depositAmount: "500", expectedProviderOrderId: "order-500" },
  ]);
});

test("editing after a failed request clears its error and prepares the new amount", async () => {
  const signature = deferred<string>();
  const h = harness(signature.promise);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await h.render({ depositAmount: "5" });
    await h.tick();
    await act(async () => signature.reject(new Error("signature rejected")));
    expect(h.current()?.error).not.toBeNull();
    await h.render({ depositAmount: "500" });
    await h.tick();
    expect(h.current()?.error).toBeNull();
    expect(h.signedRequests).toEqual([
      { depositAmount: "500", expectedProviderOrderId: "order-500" },
    ]);
  } finally {
    logged.mockRestore();
  }
});

function harness(
  firstSignature?: Promise<string>,
  firstPreview?: Promise<void>,
) {
  vi.useFakeTimers();
  const signedRequests: {
    depositAmount: string;
    expectedProviderOrderId?: string;
  }[] = [];
  const prepareAmounts: string[] = [];
  const signTypedData = vi.fn(async () => "0xnew");
  if (firstSignature)
    signTypedData.mockImplementationOnce(() => firstSignature);
  const getAccessToken = async () => "token";
  const client = createDaimoClient({
    baseUrl: "https://api.example.test",
    fetchImpl: async (input, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(input).endsWith("/deposit/prepare")) {
        prepareAmounts.push(body.depositAmount);
        return Response.json({
          kind: "transaction",
          transaction: null,
          deliverySignData: {
            domain: {},
            types: {},
            primaryType: "DeliveryConsent",
            message: {},
          },
        });
      }
      if (body.deliverySig) {
        signedRequests.push({
          depositAmount: body.depositAmount,
          expectedProviderOrderId: body.expectedProviderOrderId,
        });
      } else if (body.depositAmount === "5" && firstPreview) {
        await firstPreview;
      }
      return Response.json({
        deposit: { id: "deposit" },
        payment: {
          flow: "wallet-pay-widget",
          providerOrderId: `order-${body.depositAmount}`,
          purchaseAmount: body.depositAmount,
        },
      });
    },
  });
  let current: ReturnType<typeof useDraftDeposit> | undefined;
  type Props = Partial<
    Pick<
      Parameters<typeof useDraftDeposit>[0],
      "depositAmount" | "enabled" | "sessionId" | "rail"
    >
  >;
  function Harness(props: Props) {
    const flow = useAccountFlowState();
    const setDepositState = useCallback(
      (sessionId: string, state: DepositStateInput) => {
        stateUpdates.push(state);
        flow.setDepositState(sessionId, state);
      },
      [flow.setDepositState],
    );
    const accountFlow = {
      ...flow,
      getAccessToken,
      signTypedData,
      setDepositState,
    };
    return createElement(
      AccountFlowContext.Provider,
      { value: accountFlow },
      createElement(Draft, { ...props, accountFlow }),
    );
  }
  function Draft({
    accountFlow,
    ...props
  }: Props & { accountFlow: AccountFlowState }) {
    current = useDraftDeposit({
      client,
      accountFlow,
      depositAmount: "5",
      enabled: true,
      sessionId: "session-1",
      rail: "apple_pay",
      draftMode: "signed",
      ...props,
    });
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  return {
    signedRequests,
    prepareAmounts,
    signTypedData,
    current: () => current,
    render: async (props: Props) => {
      await act(async () =>
        root?.render(
          createElement(StrictMode, null, createElement(Harness, props)),
        ),
      );
    },
    tick: async () => {
      await act(async () => vi.advanceTimersByTimeAsync(350));
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
