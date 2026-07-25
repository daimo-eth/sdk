import { describe, expect, test } from "vitest";

import { createDaimoClient } from "./createDaimoClient.js";

describe("account wallet provisioning", () => {
  test("posts bearer auth to the idempotent wallet route", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const walletId = "wallet-primary";
    const walletAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return Response.json({ walletId, walletAddress });
      },
    });

    await expect(
      client.account.ensureWallet({ bearerToken: "privy-token" }),
    ).resolves.toEqual({ walletId, walletAddress });
    expect(requestUrl).toBe(
      "https://api.example.test/v1/internal/account/wallet",
    );
    expect(requestInit?.method).toBe("POST");
    expect(new Headers(requestInit?.headers).get("Authorization")).toBe(
      "Bearer privy-token",
    );
  });
});

describe("prepareDeposit authorization compatibility", () => {
  test("normalizes a legacy flat response from an older server", async () => {
    let requestBody: unknown;
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          routingSignData: { legacy: true },
          deliverySignData: { legacy: true },
        });
      },
    });

    await expect(
      client.account.prepareDeposit(
        {
          sessionId: "session-1",
          rail: "interac",
          depositAmount: "100",
          authorizationVersion: 2,
        },
        { bearerToken: "token" },
      ),
    ).resolves.toEqual({
      kind: "signatures",
      routingSignData: { legacy: true },
      deliverySignData: { legacy: true },
    });
    expect(requestBody).toMatchObject({ authorizationVersion: 2 });
  });

  test("preserves a v2 direct response", async () => {
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => Response.json({ kind: "direct" }),
    });

    await expect(
      client.account.prepareDeposit(
        {
          sessionId: "session-2",
          rail: "interac",
          depositAmount: "100",
          authorizationVersion: 2,
        },
        { bearerToken: "token" },
      ),
    ).resolves.toEqual({ kind: "direct" });
  });
});

describe("confirmPrivySignerEnrollment", () => {
  test("submits only the selected wallet ID with bearer auth", async () => {
    let requestUrl = "";
    let requestBody: unknown;
    let authorization = "";
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestBody = JSON.parse(String(init?.body));
        authorization = new Headers(init?.headers).get("Authorization") ?? "";
        return Response.json({
          enrollment: {
            walletId: "wallet-two",
            walletAddress: "0x0000000000000000000000000000000000000020",
            status: "active",
            signerVersion: 1,
            lastVerifiedAt: "2026-07-23T00:00:00.000Z",
          },
        });
      },
    });

    await client.account.confirmPrivySignerEnrollment(
      { walletId: "wallet-two" },
      { bearerToken: "privy-token" },
    );

    expect(requestUrl).toBe(
      "https://api.example.test/v1/internal/account/signer/confirm",
    );
    expect(requestBody).toEqual({ walletId: "wallet-two" });
    expect(authorization).toBe("Bearer privy-token");
  });
});
