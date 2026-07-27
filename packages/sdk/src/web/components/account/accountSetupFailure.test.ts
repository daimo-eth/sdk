import { describe, expect, test } from "vitest";

import { getAccountSetupFailure } from "./accountSetupFailure.js";

describe("getAccountSetupFailure", () => {
  test("preserves the Privy error code and normalizes its message", () => {
    const failure = getAccountSetupFailure("wallet_preparation", {
      message: "Wallet proxy\nnot initialized",
      privyErrorCode: "wallet_proxy_not_initialized",
    });

    expect(failure).toEqual({
      stage: "wallet_preparation",
      eventError: "wallet preparation failed: Wallet proxy not initialized",
      errorCode: "wallet_proxy_not_initialized",
    });
  });

  test("uses a nested provider error code", () => {
    const failure = getAccountSetupFailure(
      "account_creation",
      new Error("request failed", {
        cause: { code: 429 },
      }),
    );

    expect(failure).toEqual({
      stage: "account_creation",
      eventError: "account creation failed: request failed",
      errorCode: "429",
    });
  });

  test("handles unknown errors without serializing arbitrary values", () => {
    const failure = getAccountSetupFailure("wallet_preparation", {
      secret: "not for telemetry",
    });

    expect(failure).toEqual({
      stage: "wallet_preparation",
      eventError: "wallet preparation failed: unknown error",
    });
  });
});
