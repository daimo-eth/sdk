import { describe, expect, test, vi } from "vitest";

import {
  parseDaimoCountryCode,
  type RecreateSessionWithNavResponse,
} from "../../api/index.js";
import {
  recreateAccountLogoutSession,
  recreateAccountPaymentSession,
  runAccountSessionRecreateOnce,
} from "./accountSessionRecreate.js";

const RESPONSE = {
  session: {
    sessionId: "00000000-0000-4000-8000-000000000001",
    clientSecret: "new-secret",
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
    createdAt: 1_700_000_000,
    expiresAt: 1_700_086_400,
    navTree: [],
    baseUrl: "https://pay.example.com",
  },
  location: {
    countryCode: parseDaimoCountryCode("BR"),
    countryName: "Brazil",
    emoji: "🇧🇷",
  },
  locationOptions: [],
} as const satisfies RecreateSessionWithNavResponse;

describe("recreateAccountPaymentSession", () => {
  test("preserves amount on the recreated server session", async () => {
    const setDepositState = vi.fn();
    await expect(
      recreateAccountPaymentSession({
        depositAmount: "105.25",
        recreate: vi.fn(async () => RESPONSE),
        setDepositState,
      }),
    ).resolves.toBe(RESPONSE);
    expect(setDepositState).toHaveBeenCalledWith(RESPONSE.session.sessionId, {
      depositAmount: "105.25",
      kind: "idle",
    });
  });

  test("does not seed state when recreation fails", async () => {
    const setDepositState = vi.fn();
    await expect(
      recreateAccountPaymentSession({
        depositAmount: "105.25",
        recreate: vi.fn(async () => {
          throw new Error("recreate failed");
        }),
        setDepositState,
      }),
    ).rejects.toThrow("recreate failed");
    expect(setDepositState).not.toHaveBeenCalled();
  });

  test("shares concurrent retries and permits a fresh attempt after failure", async () => {
    const state = { current: null as Promise<void> | null };
    let finishFirst: (() => void) | undefined;
    const recreate = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error("recreate failed"))
      .mockResolvedValueOnce();

    const first = runAccountSessionRecreateOnce(state, recreate);
    const duplicate = runAccountSessionRecreateOnce(state, recreate);
    await vi.waitFor(() => expect(recreate).toHaveBeenCalledTimes(1));
    finishFirst?.();
    await Promise.all([first, duplicate]);

    await expect(
      runAccountSessionRecreateOnce(state, recreate),
    ).rejects.toThrow("recreate failed");
    await expect(runAccountSessionRecreateOnce(state, recreate)).resolves.toBe(
      undefined,
    );
    expect(recreate).toHaveBeenCalledTimes(3);
  });
});

describe("recreateAccountLogoutSession", () => {
  test("recreates and pins the same Account rail", async () => {
    const operations: string[] = [];
    const selectRail = vi.fn(async () => {
      operations.push("select rail");
    });
    const retrieve = vi.fn(async () => {
      operations.push("retrieve");
      return {
        ...RESPONSE,
        session: {
          ...RESPONSE.session,
          clientSecret: undefined,
        },
      };
    });
    const logout = vi.fn(async () => {
      operations.push("logout");
    });

    const result = await recreateAccountLogoutSession({
      rail: "apple_pay",
      recreate: vi.fn(async () => {
        operations.push("recreate");
        return RESPONSE;
      }),
      selectRail,
      retrieve,
      logout,
    });

    expect(selectRail).toHaveBeenCalledWith(
      RESPONSE.session.sessionId,
      RESPONSE.session.clientSecret,
      "apple_pay",
    );
    expect(retrieve).toHaveBeenCalledWith(
      RESPONSE.session.sessionId,
      RESPONSE.session.clientSecret,
    );
    expect(result.session.clientSecret).toBe(RESPONSE.session.clientSecret);
    expect(operations).toEqual([
      "recreate",
      "select rail",
      "retrieve",
      "logout",
    ]);
  });

  test("does not commit navigation when rail selection fails", async () => {
    const retrieve = vi.fn();
    const logout = vi.fn();

    await expect(
      recreateAccountLogoutSession({
        rail: "apple_pay",
        recreate: vi.fn(async () => RESPONSE),
        selectRail: vi.fn(async () => {
          throw new Error("rail selection failed");
        }),
        retrieve,
        logout,
      }),
    ).rejects.toThrow("rail selection failed");
    expect(retrieve).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });
});
