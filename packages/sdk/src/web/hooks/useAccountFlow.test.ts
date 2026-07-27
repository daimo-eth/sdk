import { afterEach, describe, expect, test, vi } from "vitest";
import { getAddress } from "viem";

import {
  accountWalletAddressesMatch,
  waitForAccountFlowState,
} from "./useAccountFlow.js";

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
