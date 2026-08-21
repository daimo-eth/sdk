import { describe, expect, test } from "vitest";

import type { SessionPublicInfo } from "../../common/session.js";
import type { SessionWithNav } from "../api/navTree.js";

import { mergeSessionPollResult } from "./useSessionPolling.js";

const DESTINATION = {
  type: "evm" as const,
  address: "0x1234567890123456789012345678901234567890" as const,
  chainId: 8453,
  chainName: "base",
  tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const,
  tokenSymbol: "USDC",
};

const OLD_SESSION: SessionWithNav = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  clientSecret: "old-secret",
  status: "requires_payment_method",
  destination: DESTINATION,
  display: { title: "Deposit", verb: "Deposit" },
  paymentMethod: null,
  createdAt: 1,
  expiresAt: 2,
  navTree: [],
  baseUrl: "https://pay.example.com",
};

const POLL_UPDATE: SessionPublicInfo = {
  sessionId: OLD_SESSION.sessionId,
  status: "waiting_payment",
  destination: DESTINATION,
  display: OLD_SESSION.display,
  paymentMethod: null,
  createdAt: OLD_SESSION.createdAt,
  expiresAt: OLD_SESSION.expiresAt,
};

describe("mergeSessionPollResult", () => {
  test("merges a poll result for the active session", () => {
    const result = mergeSessionPollResult(
      OLD_SESSION,
      {
        sessionId: OLD_SESSION.sessionId,
        clientSecret: OLD_SESSION.clientSecret,
      },
      POLL_UPDATE,
    );

    expect(result.status).toBe("waiting_payment");
    expect(result.clientSecret).toBe("old-secret");
  });

  test("ignores an old poll after session recreation", () => {
    const recreatedSession: SessionWithNav = {
      ...OLD_SESSION,
      sessionId: "00000000-0000-4000-8000-000000000002",
      clientSecret: "new-secret",
    };

    const result = mergeSessionPollResult(
      recreatedSession,
      {
        sessionId: OLD_SESSION.sessionId,
        clientSecret: OLD_SESSION.clientSecret,
      },
      POLL_UPDATE,
    );

    expect(result).toBe(recreatedSession);
  });
});
