// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { SessionWithNav } from "../api/navTree.js";
import { DaimoSDKProvider } from "./DaimoClientContext.js";
import { useSessionPolling } from "./useSessionPolling.js";

const session: SessionWithNav = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  clientSecret: "test-secret",
  status: "waiting_payment",
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
  navTree: [],
  baseUrl: "https://api.test",
};

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const fetchMock = vi.fn<typeof fetch>();
let root: Root;

function Harness({ open = true }: { open?: boolean }) {
  useSessionPolling(session, open);
  return null;
}

async function render(open = true) {
  await act(async () =>
    root.render(
      createElement(DaimoSDKProvider, {
        apiUrl: "https://api.test",
        children: createElement(Harness, { open }),
      }),
    ),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  fetchMock.mockImplementation(async () => Response.json({ session }));
  root = createRoot(document.createElement("div"));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

test("does not overlap a slow check, including after close and reopen", async () => {
  let resolve: (response: Response) => void = () => {};
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  await render();
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await render(false);
  await render(true);
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => resolve(Response.json({ session })));
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("slows unchanged waiting sessions and pauses hidden pages", async () => {
  await render();
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  const calls = fetchMock.mock.calls.length;
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(fetchMock).toHaveBeenCalledTimes(calls);
});

test("stops after a terminal result", async () => {
  fetchMock.mockImplementation(async (url) =>
    String(url).endsWith("/check")
      ? Response.json({ session: { ...session, status: "expired" } })
      : Response.json({}),
  );
  await render();
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/check")),
  ).toHaveLength(1);
});
