import { describe, expect, test, vi } from "vitest";

import { createDaimoClient } from "../../client/createDaimoClient.js";
import type { AccountFlowState } from "./useAccountFlow.js";
import { signAndUpsertDeposit } from "./useDraftDeposit.js";

describe("signAndUpsertDeposit", () => {
  test("does not request signatures for direct delivery", async () => {
    const requestBodies: unknown[] = [];
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requestBodies.push(JSON.parse(String(init?.body)));
        if (String(input).endsWith("/deposit/prepare")) {
          return Response.json({ kind: "direct" });
        }
        return Response.json({ deposit: { id: "deposit-1" }, payment: null });
      },
    });
    const signTypedData = vi.fn(async () => "0xsignature");
    const accountFlow = {
      getAccessToken: vi.fn(async () => "access-token"),
      signTypedData,
    } as unknown as AccountFlowState;

    await signAndUpsertDeposit({
      client,
      accountFlow,
      sessionId: "session-1",
      depositAmount: "100",
      rail: "interac",
    });

    expect(signTypedData).not.toHaveBeenCalled();
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]).toMatchObject({ authorizationVersion: 2 });
    expect(requestBodies[1]).toMatchObject({
      authorizationVersion: 2,
      sessionId: "session-1",
    });
    expect(requestBodies[1]).not.toMatchObject({
      routingSig: expect.anything(),
      deliverySig: expect.anything(),
    });
  });

  test("sends an EIP-7702 approval before it starts the deposit", async () => {
    const requestBodies: unknown[] = [];
    const deliverySignData = {
      domain: { name: "Daimo Pay" },
      types: {},
      primaryType: "DeliveryConsent",
      message: { fiatAmount: "49.88" },
    };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requestBodies.push(JSON.parse(String(init?.body)));
        if (String(input).endsWith("/deposit/prepare")) {
          return Response.json({
            kind: "transaction",
            transaction: {
              chainId: 8453,
              to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              data: "0x095ea7b3",
            },
            deliverySignData,
          });
        }
        return Response.json({ deposit: { id: "deposit-1" }, payment: null });
      },
    });
    const sendSponsoredTransaction = vi.fn(async () => "0xapproval" as const);
    const signTypedData = vi.fn(async () => "0xdelivery");
    const accountFlow = {
      getAccessToken: vi.fn(async () => "access-token"),
      sendSponsoredTransaction,
      signTypedData,
    } as unknown as AccountFlowState;

    await signAndUpsertDeposit({
      client,
      accountFlow,
      sessionId: "session-1",
      depositAmount: "50",
      authorizedAmount: "49.88",
      rail: "apple_pay",
    });

    expect(sendSponsoredTransaction).toHaveBeenCalledWith({
      chainId: 8453,
      to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      data: "0x095ea7b3",
    });
    expect(signTypedData).toHaveBeenCalledOnce();
    expect(signTypedData).toHaveBeenCalledWith(deliverySignData);
    expect(requestBodies[0]).toMatchObject({ depositAmount: "49.88" });
    expect(requestBodies[1]).toMatchObject({
      depositAmount: "50",
      deliverySig: "0xdelivery",
      deliverySigData: deliverySignData,
      routingApproval: { transactionHash: "0xapproval" },
    });
    expect(requestBodies[1]).not.toMatchObject({
      routingSig: expect.anything(),
    });
  });

  test("reuses an existing exact EIP-7702 approval", async () => {
    const requestBodies: unknown[] = [];
    const deliverySignData = {
      domain: {},
      types: {},
      primaryType: "DeliveryConsent",
      message: {},
    };
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requestBodies.push(JSON.parse(String(init?.body)));
        if (String(input).endsWith("/deposit/prepare")) {
          return Response.json({
            kind: "transaction",
            transaction: null,
            deliverySignData,
          });
        }
        return Response.json({ deposit: { id: "deposit-1" }, payment: null });
      },
    });
    const sendSponsoredTransaction = vi.fn();
    const accountFlow = {
      getAccessToken: vi.fn(async () => "access-token"),
      sendSponsoredTransaction,
      signTypedData: vi.fn(async () => "0xdelivery"),
    } as unknown as AccountFlowState;

    await signAndUpsertDeposit({
      client,
      accountFlow,
      sessionId: "session-1",
      depositAmount: "50",
      authorizedAmount: "49.88",
      rail: "apple_pay",
    });

    expect(sendSponsoredTransaction).not.toHaveBeenCalled();
    expect(requestBodies[1]).toMatchObject({ routingApproval: {} });
  });

  test("does not start the deposit when the approval transaction fails", async () => {
    const requestBodies: unknown[] = [];
    const client = createDaimoClient({
      baseUrl: "https://api.example.test",
      fetchImpl: async (input, init) => {
        requestBodies.push(JSON.parse(String(init?.body)));
        if (String(input).endsWith("/deposit/prepare")) {
          return Response.json({
            kind: "transaction",
            transaction: {
              chainId: 8453,
              to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              data: "0x095ea7b3",
            },
            deliverySignData: {
              domain: {},
              types: {},
              primaryType: "DeliveryConsent",
              message: {},
            },
          });
        }
        return Response.json({ deposit: { id: "deposit-1" }, payment: null });
      },
    });
    const signTypedData = vi.fn();
    const accountFlow = {
      getAccessToken: vi.fn(async () => "access-token"),
      sendSponsoredTransaction: vi.fn(async () => {
        throw new Error("approval failed");
      }),
      signTypedData,
    } as unknown as AccountFlowState;

    await expect(
      signAndUpsertDeposit({
        client,
        accountFlow,
        sessionId: "session-1",
        depositAmount: "50",
        authorizedAmount: "49.88",
        rail: "apple_pay",
      }),
    ).rejects.toThrow("approval failed");

    expect(requestBodies).toHaveLength(1);
    expect(signTypedData).not.toHaveBeenCalled();
  });
});
