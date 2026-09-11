// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { decodeFunctionData, getAddress, parseAbi } from "viem";
import { baseETH } from "../../common/token.js";
import { createDaimoClient } from "../../client/createDaimoClient.js";
import type { SessionWithNav } from "../api/navTree.js";
import type { WalletPaymentOption } from "../api/walletTypes.js";
import { DaimoModal } from "../components/DaimoModal.js";
import { setLocale } from "./locale.js";
import { useDepositAddress } from "./useDepositAddress.js";
import { useWalletFlow, type WalletFlowResult } from "./useWalletFlow.js";

vi.mock("./DaimoClientContext.js", () => ({ useDaimoClient: () => client }));
const client = createDaimoClient({
  baseUrl: "https://example.test",
  fetchImpl: async () => {
    throw new Error("unexpected request");
  },
});
const wallet = getAddress("0x1111111111111111111111111111111111111111");
const receiver = getAddress("0x2222222222222222222222222222222222222222");
const token = {
  chainId: 8453,
  token: getAddress("0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42"),
  symbol: "EURC",
  decimals: 6,
  fiatISO: "EUR",
  logoURI: "",
  logoSourceURI: "",
  usd: 1.16,
  priceFromUsd: 1 / 1.16,
  maxAcceptUsd: 1000,
  maxSendUsd: 1000,
  displayDecimals: 2,
};
const zero = { token, amount: "0" as const, usd: 0 };
const option: WalletPaymentOption = {
  balance: { token, amount: "30000000", usd: 34.8 },
  required: zero,
  minimumRequired: zero,
  fees: zero,
};
const session: SessionWithNav = {
  sessionId: "recovery-session",
  clientSecret: "secret",
  status: "requires_payment_method",
  destination: {
    type: "evm",
    address: receiver,
    chainId: 42220,
    chainName: "celo",
    tokenAddress: receiver,
    tokenSymbol: "USDT",
  },
  display: { title: "Deposit", verb: "Deposit" },
  paymentMethod: null,
  createdAt: 1,
  expiresAt: 9999999999,
  baseUrl: "https://example.test",
  navTree: [
    { type: "ConnectedWallet", id: "ConnectedWallet", title: "Wallet" },
  ],
};
function paymentResult(address: string = receiver) {
  return {
    session: {
      ...session,
      paymentMethod: {
        type: "evm" as const,
        receiverAddress: address as `0x${string}`,
        createdAt: 1,
      },
    },
  };
}
const request = vi.fn(
  async ({
    method,
  }: {
    method: string;
    params?: unknown[];
  }): Promise<unknown> => {
    if (method === "eth_accounts") return [wallet];
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_sendTransaction") return "0xabc";
    throw new Error(`unexpected wallet method: ${method}`);
  },
);
const provider = { request };
const wallets = [
  {
    info: { name: "Test", icon: "", rdns: "test", uuid: "test" },
    evmProvider: provider,
  },
];
let root: Root;
let container: HTMLDivElement;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  setLocale("en");
  request.mockClear();
  vi.spyOn(client.internal.sessions, "retrieveWithNav").mockResolvedValue({
    session,
    location: {
      countryCode: null,
      countryName: "Location unknown",
      emoji: "🌐",
    },
    locationOptions: [],
  });
  vi.spyOn(client.internal.sessions, "walletOptions").mockResolvedValue([
    option,
  ]);
  vi.spyOn(client.internal.sessions, "logNavEvent").mockResolvedValue(
    undefined,
  );
  vi.spyOn(client.sessions, "check").mockResolvedValue({ session });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
async function mountModal() {
  await act(async () =>
    root.render(
      createElement(DaimoModal, {
        sessionId: session.sessionId,
        clientSecret: session.clientSecret,
        embedded: true,
        connectToAddress: wallet,
        connectToEvmProvider: provider,
      }),
    ),
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("wallet modal waits for address setup, shows its error, and retries setup", async () => {
  const pending = deferred<ReturnType<typeof paymentResult>>();
  const create = vi
    .spyOn(client.sessions.paymentMethods, "create")
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(paymentResult());
  await mountModal();
  expect(container.textContent).not.toContain("EURC");
  await act(async () =>
    pending.reject(
      new Error("payment method not allowed for fixed type: SEPA"),
    ),
  );
  expect(container.textContent).toContain(
    "payment method not allowed for fixed type: SEPA",
  );
  expect(
    request.mock.calls.some(([call]) => call.method === "eth_sendTransaction"),
  ).toBe(false);
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  expect(retry).toBeDefined();
  await act(async () => retry?.click());
  expect(create).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("EURC");
  expect(container.textContent).not.toContain("payment method not allowed");
});

test.each(["", "0x1234"])(
  "rejects malformed receiver %s before payment",
  async (address) => {
    vi.spyOn(client.sessions.paymentMethods, "create").mockResolvedValue(
      paymentResult(address),
    );
    await mountModal();
    expect(container.textContent).toContain("invalid deposit address");
    expect(container.textContent).not.toContain("EURC");
    expect(
      request.mock.calls.some(
        ([call]) => call.method === "eth_sendTransaction",
      ),
    ).toBe(false);
  },
);

test("ignores an address from a previous session after the session changes", async () => {
  const first = deferred<ReturnType<typeof paymentResult>>();
  const second = deferred<ReturnType<typeof paymentResult>>();
  vi.spyOn(client.sessions.paymentMethods, "create")
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  function Harness({ value }: { value: SessionWithNav }) {
    const result = useDepositAddress(value);
    return createElement("p", null, result?.address ?? "waiting");
  }
  await act(async () =>
    root.render(createElement(Harness, { value: session })),
  );
  await act(async () =>
    root.render(
      createElement(Harness, { value: { ...session, sessionId: "second" } }),
    ),
  );
  await act(async () => first.resolve(paymentResult()));
  expect(container.textContent).toBe("waiting");
  await act(async () => second.resolve(paymentResult(wallet)));
  expect(container.textContent).toBe(wallet);
});

test.each(["erc20", "native"])(
  "%s send rejects a missing address and sends only after setup succeeds",
  async (asset) => {
    const paymentOption = {
      ...option,
      balance: {
        ...option.balance,
        token: asset === "native" ? { ...token, ...baseETH } : token,
      },
    };
    let flow: WalletFlowResult | undefined;
    function Harness({ address }: { address: typeof receiver | null }) {
      flow = useWalletFlow(
        "send-guard-session",
        address,
        "passive",
        "secret",
        wallets,
        wallet,
      );
      return null;
    }
    await act(async () =>
      root.render(createElement(Harness, { address: null })),
    );
    expect(flow?.wallet?.evmAddress).toBe(wallet);
    await expect(flow?.sendTransaction(paymentOption, 34.8)).rejects.toThrow(
      "deposit address is not ready",
    );
    expect(
      request.mock.calls.some(
        ([call]) => call.method === "eth_sendTransaction",
      ),
    ).toBe(false);
    await act(async () =>
      root.render(createElement(Harness, { address: receiver })),
    );
    await expect(flow?.sendTransaction(paymentOption, 34.8)).resolves.toEqual({
      txHash: "0xabc",
    });
    const sent = request.mock.calls.find(
      ([call]) => call.method === "eth_sendTransaction",
    )?.[0].params?.[0];
    if (asset === "native") {
      expect(sent).toEqual({ from: wallet, to: receiver, value: "0x1c9c380" });
      return;
    }
    expect(sent).toMatchObject({ from: wallet, to: token.token });
    if (
      !sent ||
      typeof sent !== "object" ||
      !("data" in sent) ||
      typeof sent.data !== "string"
    )
      throw new Error("missing transfer data");
    const decoded = decodeFunctionData({
      abi: parseAbi([
        "function transfer(address to, uint256 amount) returns (bool)",
      ]),
      data: sent.data as `0x${string}`,
    });
    expect(decoded.args).toEqual([receiver, 30000000n]);
  },
);

test("reuses a valid existing receiver without creating a payment method", async () => {
  const create = vi.spyOn(client.sessions.paymentMethods, "create");
  function Harness() {
    const result = useDepositAddress({
      ...session,
      paymentMethod: paymentResult().session.paymentMethod,
    });
    return createElement("p", null, result?.address ?? "waiting");
  }
  await act(async () => root.render(createElement(Harness)));
  expect(container.textContent).toBe(receiver);
  expect(create).not.toHaveBeenCalled();
});

test("does not request an EVM payment method for fiat-only navigation", async () => {
  const create = vi.spyOn(client.sessions.paymentMethods, "create");
  function Harness() {
    useDepositAddress({
      ...session,
      navTree: [
        { type: "Fiat", id: "sepa", title: "SEPA", fiatMethod: "sepa" },
      ],
    });
    return null;
  }
  await act(async () => root.render(createElement(Harness)));
  expect(create).not.toHaveBeenCalled();
});
