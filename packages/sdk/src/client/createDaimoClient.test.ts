import { describe, expect, test } from "vitest";

import { base, solana, supportedChains } from "../common/chain.js";
import type { WalletPaymentOption } from "../web/api/walletTypes.js";
import { createDaimoClient } from "./createDaimoClient.js";

describe("wallet option chain compatibility", () => {
  const unknownChainId = 987654321;
  const optionForChain = (chainId: number): WalletPaymentOption => {
    const balance = {
      token: {
        chainId,
        token: "0x0000000000000000000000000000000000000001",
        symbol: "USDC",
        decimals: 6,
        logoURI: "",
        logoSourceURI: "",
        usd: 1,
        priceFromUsd: 1,
        maxAcceptUsd: 1000,
        maxSendUsd: 1000,
        displayDecimals: 2,
      },
      amount: "5000000" as const,
      usd: 5,
    };
    return {
      balance,
      required: balance,
      minimumRequired: balance,
      fees: balance,
    };
  };

  test.each([
    { chainIds: [unknownChainId, base.chainId, solana.chainId] },
    { chainIds: [unknownChainId] },
    { chainIds: [] },
    { chainIds: supportedChains.map((chain) => chain.chainId) },
  ])("ignores unknown chains in response $chainIds", async ({ chainIds }) => {
    expect(
      supportedChains.some((chain) => chain.chainId === unknownChainId),
    ).toBe(false);
    const options = chainIds.map(optionForChain);
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => Response.json(options),
    });

    await expect(
      client.internal.sessions.walletOptions("session", {
        clientSecret: "secret",
        evmAddress: "0x0000000000000000000000000000000000000001",
      }),
    ).resolves.toEqual(
      options.filter(
        (option) => option.balance.token.chainId !== unknownChainId,
      ),
    );
  });
});

describe("internal ENS resolution", () => {
  test("uses the configured API URL", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const response = {
      name: "vitalik.eth",
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    } as const;
    const client = createDaimoClient({
      baseUrl: "https://api.example.test/custom/",
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return Response.json(response);
      },
    });

    await expect(client.internal.ens.resolve("VITALIK.ETH ")).resolves.toEqual(
      response,
    );
    expect(requestUrl).toBe(
      "https://api.example.test/custom/v1/internal/ens/resolve?name=VITALIK.ETH+",
    );
    expect(requestInit?.method).toBe("GET");
  });
});

describe("internal session recreation", () => {
  test("sends Account binding isolation for logout", async () => {
    let requestUrl = "";
    let requestBody: unknown;
    const response = { session: { sessionId: "session-new" } };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestBody = JSON.parse(String(init?.body));
        return Response.json(response);
      },
    });

    await expect(
      client.internal.sessions.recreate("session-old", "secret", {
        accountBinding: "clear",
      }),
    ).resolves.toEqual(response);
    expect(requestUrl).toBe(
      "https://api.example.test/v1/sessions/session-old/internal/recreate",
    );
    expect(requestBody).toMatchObject({
      clientSecret: "secret",
      accountBinding: "clear",
    });
  });
});

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

  test("preserves a v2 transaction response", async () => {
    const response = {
      kind: "transaction" as const,
      transaction: {
        chainId: 8453,
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
        data: "0x095ea7b3" as const,
      },
      deliverySignData: {
        domain: {},
        types: {},
        primaryType: "DeliveryConsent",
        message: {},
      },
    };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async () => Response.json(response),
    });

    await expect(
      client.account.prepareDeposit(
        {
          sessionId: "session-3",
          rail: "apple_pay",
          depositAmount: "49.88",
          authorizationVersion: 2,
        },
        { bearerToken: "token" },
      ),
    ).resolves.toEqual(response);
  });
});
