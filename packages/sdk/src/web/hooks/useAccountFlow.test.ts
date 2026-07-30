import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";

import type { DaimoClient } from "../../client/createDaimoClient.js";
import {
  type AccountFlowState,
  type PrivyHooks,
  preparePrivyWallet,
  waitForAccountFlowState,
} from "./useAccountFlow.js";

test("preserves legacy account flow method contracts", () => {
  expectTypeOf<AccountFlowState["ensureWallet"]>().toEqualTypeOf<
    () => Promise<string>
  >();
  expectTypeOf<AccountFlowState["createAccount"]>().toEqualTypeOf<
    (
      client: DaimoClient,
      session: { sessionId: string; clientSecret: string },
      walletAddress: string,
    ) => Promise<void>
  >();
});

test("accepts the legacy Privy hook registration shape", () => {
  const hooks = {
    sendCode: async () => {},
    loginWithCode: async () => {},
    createWallet: async () => ({ address: "0x1234" }),
    getAccessToken: async () => null,
    signTypedData: async () => "0x",
    sendSponsoredTransaction: async () => "0x" as const,
    logout: async () => {},
    ready: true,
    authenticated: false,
    email: null,
    walletAddress: null,
    hasEmbeddedWallet: false,
    phoneNumber: null,
  } satisfies PrivyHooks;

  expect(hooks.ready).toBe(true);
});

describe("preparePrivyWallet", () => {
  test("uses the existing embedded wallet address", async () => {
    const createWallet = vi.fn();

    await expect(
      preparePrivyWallet({
        createWallet,
        hasEmbeddedWallet: true,
        walletAddress: "0x1234",
      }),
    ).resolves.toBe("0x1234");
    expect(createWallet).not.toHaveBeenCalled();
  });

  test("creates a wallet in the authenticated browser", async () => {
    const createWallet = vi.fn(async () => ({ address: "0x5678" }));

    await expect(
      preparePrivyWallet({
        createWallet,
        hasEmbeddedWallet: false,
        walletAddress: null,
      }),
    ).resolves.toBe("0x5678");
    expect(createWallet).toHaveBeenCalledOnce();
  });

  test("does not create a second wallet when metadata lacks an address", async () => {
    const createWallet = vi.fn();

    await expect(
      preparePrivyWallet({
        createWallet,
        hasEmbeddedWallet: true,
        walletAddress: null,
      }),
    ).rejects.toThrow("embedded wallet address unavailable");
    expect(createWallet).not.toHaveBeenCalled();
  });
});

describe("waitForAccountFlowState", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("resolves immediately when state is ready", async () => {
    const isReady = vi.fn(() => true);

    await expect(
      waitForAccountFlowState(isReady, "state timed out"),
    ).resolves.toBeUndefined();
    expect(isReady).toHaveBeenCalledOnce();
  });

  test("resolves when state becomes ready", async () => {
    vi.useFakeTimers();
    let ready = false;
    const result = waitForAccountFlowState(
      () => ready,
      "state timed out",
      1_000,
    );

    ready = true;
    await vi.advanceTimersByTimeAsync(50);

    await expect(result).resolves.toBeUndefined();
  });

  test("rejects after the configured timeout", async () => {
    vi.useFakeTimers();
    const result = waitForAccountFlowState(
      () => false,
      "wallet initialization timed out",
      100,
    );
    const assertion = expect(result).rejects.toThrow(
      "wallet initialization timed out",
    );

    await vi.advanceTimersByTimeAsync(100);

    await assertion;
  });
});
