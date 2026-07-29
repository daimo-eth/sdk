import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import { getAddress } from "viem";

import type { DaimoClient } from "../../client/createDaimoClient.js";
import type { PrivySignerConfig } from "../../common/account.js";
import {
  type AccountFlowState,
  type PrivyHooks,
  accountWalletAddressesMatch,
  waitForAccountFlowState,
} from "./useAccountFlow.js";

test("preserves legacy account flow method contracts", () => {
  expectTypeOf<AccountFlowState["ensureWallet"]>().toEqualTypeOf<
    (client: DaimoClient) => Promise<string>
  >();
  expectTypeOf<AccountFlowState["createAccount"]>().toEqualTypeOf<
    (
      client: DaimoClient,
      session: { sessionId: string; clientSecret: string },
      walletAddress: string,
    ) => Promise<void>
  >();
  expectTypeOf<AccountFlowState["authorizeWalletSigner"]>()
    .parameter(2)
    .toEqualTypeOf<PrivySignerConfig>();
});

test("accepts the legacy Privy hook registration shape", () => {
  const hooks = {
    sendCode: async () => {},
    loginWithCode: async () => {},
    refreshUser: async () => {},
    getAccessToken: async () => null,
    signTypedData: async () => "0x",
    sendSponsoredTransaction: async () => "0x" as const,
    logout: async () => {},
    ready: true,
    authenticated: false,
    email: null,
    walletAddress: null,
    phoneNumber: null,
  } satisfies PrivyHooks;

  expect(hooks.ready).toBe(true);
});

test("matches the same wallet across address casing", () => {
  const lowercase = "0x1234567890abcdef1234567890abcdef12345678";

  expect(accountWalletAddressesMatch(getAddress(lowercase), lowercase)).toBe(
    true,
  );
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
