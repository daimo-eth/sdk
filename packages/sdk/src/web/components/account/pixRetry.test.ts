import { describe, expect, test, vi } from "vitest";

import type { GetAccountResponse } from "../../../common/account.js";
import {
  parseDaimoCountryCode,
  type RecreateSessionWithNavResponse,
} from "../../api/index.js";
import type { SessionWithNav } from "../../api/navTree.js";
import {
  resolvePixRetryNavTarget,
  runPixRetryFlow,
} from "./pixRetry.js";

const NODE_ID = "pix-node";
const DEPOSIT_AMOUNT = "42.50";

function mockSession(overrides?: Partial<SessionWithNav>): SessionWithNav {
  return {
    sessionId: "00000000-0000-4000-8000-000000000001",
    clientSecret: "new-secret",
    status: "requires_payment_method",
    destination: {
      type: "evm",
      address: "0x1234567890123456789012345678901234567890",
      chainId: 137,
      chainName: "polygon",
      tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      tokenSymbol: "USDC",
    },
    display: {
      title: "Deposit",
      verb: "Deposit",
    },
    paymentMethod: null,
    createdAt: 1_700_000_000,
    expiresAt: 1_700_086_400,
    navTree: [],
    baseUrl: "https://pay.example.com",
    ...overrides,
  };
}

function mockRecreateResponse(
  overrides?: Partial<RecreateSessionWithNavResponse>,
): RecreateSessionWithNavResponse {
  const countryCode = parseDaimoCountryCode("BR");
  return {
    session: mockSession(),
    location: {
      countryCode,
      countryName: "Brazil",
      emoji: "🇧🇷",
    },
    locationOptions: [],
    ...overrides,
  };
}

function readyAccount(): GetAccountResponse {
  return {
    account: {
      id: "acct-1",
      email: "user@example.com",
      walletAddress: "0x1234567890123456789012345678901234567890",
    },
    nextAction: "ready_for_payment",
  };
}

describe("resolvePixRetryNavTarget", () => {
  test("ready_for_payment opens request-to-pay directly", () => {
    expect(
      resolvePixRetryNavTarget(
        { hasAuth: true, account: readyAccount() },
        { nodeId: NODE_ID },
      ),
    ).toEqual({
      type: "account-request-to-pay",
      nodeId: NODE_ID,
      rail: "pix",
      autoNav: true,
    });
  });

  test("missing auth falls back to normal navigation", () => {
    expect(
      resolvePixRetryNavTarget(
        { hasAuth: false, account: readyAccount() },
        { nodeId: NODE_ID },
      ),
    ).toBe("normal-navigation");
  });

  test("lookup failure falls back to normal navigation", () => {
    expect(
      resolvePixRetryNavTarget(
        { hasAuth: true, account: null },
        { nodeId: NODE_ID },
      ),
    ).toBe("normal-navigation");
  });

  test("enrollment re-enters payment with enrollment required", () => {
    expect(
      resolvePixRetryNavTarget(
        {
          hasAuth: true,
          account: {
            account: {
              id: "acct-1",
              email: "user@example.com",
              walletAddress: "0x1234567890123456789012345678901234567890",
            },
            nextAction: "enrollment",
          },
        },
        { nodeId: NODE_ID },
      ),
    ).toEqual({
      type: "account-payment",
      nodeId: NODE_ID,
      rail: "pix",
      autoNav: true,
      requireEnrollment: true,
    });
  });

  test("enrollment_update opens the update screen", () => {
    const update = {
      type: "apple_pay_enhanced_verification" as const,
      rail: "apple_pay" as const,
      status: "required" as const,
      fields: [],
    };
    expect(
      resolvePixRetryNavTarget(
        {
          hasAuth: true,
          account: {
            account: {
              id: "acct-1",
              email: "user@example.com",
              walletAddress: "0x1234567890123456789012345678901234567890",
            },
            nextAction: "enrollment_update",
            enrollmentUpdate: update,
          },
        },
        { nodeId: NODE_ID },
      ),
    ).toEqual({
      type: "account-enrollment-update",
      nodeId: NODE_ID,
      rail: "pix",
      autoNav: true,
      update,
    });
  });

  test("create_account falls back to normal navigation", () => {
    expect(
      resolvePixRetryNavTarget(
        {
          hasAuth: true,
          account: { account: null, nextAction: "create_account" },
        },
        { nodeId: NODE_ID },
      ),
    ).toBe("normal-navigation");
  });
});

describe("runPixRetryFlow", () => {
  test("links recreated session before opening PIX", async () => {
    const response = mockRecreateResponse();
    const recreate = vi.fn(async () => response);
    const waitForAuthReady = vi.fn(async () => {});
    const getAccessToken = vi.fn(async () => "token");
    const getAccount = vi.fn(async () => readyAccount());
    const setDepositState = vi.fn();

    const result = await runPixRetryFlow({
      depositAmount: DEPOSIT_AMOUNT,
      nodeId: NODE_ID,
      recreate,
      waitForAuthReady,
      getAccessToken,
      getAccount,
      setDepositState,
    });

    expect(recreate).toHaveBeenCalledOnce();
    expect(setDepositState).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      {
      depositAmount: DEPOSIT_AMOUNT,
      kind: "idle",
    },
    );
    expect(waitForAuthReady).toHaveBeenCalledOnce();
    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(getAccount).toHaveBeenCalledWith({
      sessionId: "00000000-0000-4000-8000-000000000001",
      clientSecret: "new-secret",
    });
    expect(getAccount.mock.invocationCallOrder[0]).toBeGreaterThan(
      recreate.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({
      ok: true,
      response,
      nav: {
        type: "account-request-to-pay",
        nodeId: NODE_ID,
        rail: "pix",
        autoNav: true,
      },
    });
  });

  test("lookup failure falls back to normal navigation", async () => {
    const response = mockRecreateResponse();
    const result = await runPixRetryFlow({
      depositAmount: DEPOSIT_AMOUNT,
      nodeId: NODE_ID,
      recreate: vi.fn(async () => response),
      waitForAuthReady: vi.fn(async () => {}),
      getAccessToken: vi.fn(async () => "token"),
      getAccount: vi.fn(async () => null),
      setDepositState: vi.fn(),
    });

    expect(result).toEqual({
      ok: true,
      response,
      nav: "normal-navigation",
    });
  });

  test("recreate failure leaves the caller on the current screen", async () => {
    const result = await runPixRetryFlow({
      depositAmount: DEPOSIT_AMOUNT,
      nodeId: NODE_ID,
      recreate: vi.fn(async () => {
        throw new Error("recreate failed");
      }),
      waitForAuthReady: vi.fn(async () => {}),
      getAccessToken: vi.fn(async () => "token"),
      getAccount: vi.fn(async () => readyAccount()),
      setDepositState: vi.fn(),
    });

    expect(result).toEqual({ ok: false });
  });
});
