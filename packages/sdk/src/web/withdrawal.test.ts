import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";

import type { DaimoClient } from "../client/createDaimoClient.js";
import { solana } from "../common/chain.js";
import { baseUSDC } from "../common/token.js";
import {
  ManualWithdrawalSession,
  buildDaimoWithdrawalDestination,
  readDaimoWithdrawalContacts,
  removeDaimoWithdrawalContact,
  resolveWithdrawalIdentifier,
  saveDaimoWithdrawalContact,
  type DaimoWithdrawalContact,
} from "./withdrawal.js";
import { getDaimoWithdrawalDestinationRoute } from "../common/withdrawal.js";

const EVM_ADDRESS = getAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
const RECEIVER_ADDRESS = getAddress(
  "0x1111111111111111111111111111111111111111",
);

describe("withdrawal identifiers", () => {
  it("checksums EVM addresses and accepts Solana addresses", async () => {
    await expect(
      resolveWithdrawalIdentifier(EVM_ADDRESS.toLowerCase(), vi.fn()),
    ).resolves.toMatchObject({ identifierType: "evm", address: EVM_ADDRESS });
    await expect(
      resolveWithdrawalIdentifier(
        "Vote111111111111111111111111111111111111111",
        vi.fn(),
      ),
    ).resolves.toMatchObject({ identifierType: "solana" });
  });

  it("normalizes and resolves ENS names", async () => {
    const resolveEns = vi.fn().mockResolvedValue({ address: EVM_ADDRESS });
    await expect(
      resolveWithdrawalIdentifier("VITALIK.ETH ", resolveEns),
    ).resolves.toEqual({
      identifier: "vitalik.eth",
      identifierType: "ens",
      address: EVM_ADDRESS,
    });
    expect(resolveEns).toHaveBeenCalledWith("vitalik.eth");
  });

  it("rejects invalid identifiers and propagates ENS failures", async () => {
    await expect(
      resolveWithdrawalIdentifier("not-an-address", vi.fn()),
    ).rejects.toThrow("enter a valid EVM address, Solana address, or ENS name");
    await expect(
      resolveWithdrawalIdentifier(
        "missing.eth",
        vi.fn().mockRejectedValue(new Error("ens name not found")),
      ),
    ).rejects.toThrow("ens name not found");
  });

  it("restricts Solana identifiers to Solana routes", async () => {
    const identifier = await resolveWithdrawalIdentifier(
      "Vote111111111111111111111111111111111111111",
      vi.fn(),
    );
    const route = getDaimoWithdrawalDestinationRoute("USDC", 8453)!;
    expect(() => buildDaimoWithdrawalDestination(identifier, route)).toThrow(
      "Solana recipients require the Solana network",
    );
  });
});

describe("withdrawal contacts", () => {
  const contact: DaimoWithdrawalContact = {
    identifier: "vitalik.eth",
    identifierType: "ens",
    asset: "USDC",
    chainId: 8453,
    lastUsedAt: 10,
  };

  it("persists, deduplicates, orders, and removes contacts", () => {
    const storage = createStorage();
    saveDaimoWithdrawalContact(contact, storage);
    saveDaimoWithdrawalContact({ ...contact, lastUsedAt: 20 }, storage);
    saveDaimoWithdrawalContact(
      {
        ...contact,
        identifier: EVM_ADDRESS,
        identifierType: "evm",
        lastUsedAt: 15,
      },
      storage,
    );

    expect(
      readDaimoWithdrawalContacts(storage).map((item) => item.lastUsedAt),
    ).toEqual([20, 15]);
    expect(removeDaimoWithdrawalContact(contact, storage)).toHaveLength(1);
  });

  it("ignores malformed and unknown-version storage", () => {
    const malformed = createStorage("{");
    expect(readDaimoWithdrawalContacts(malformed)).toEqual([]);
    const future = createStorage(JSON.stringify({ version: 2, contacts: [] }));
    expect(readDaimoWithdrawalContacts(future)).toEqual([]);
  });

  it("ignores invalid contact identifiers and incompatible routes", () => {
    const storage = createStorage(
      JSON.stringify({
        version: 1,
        contacts: [
          { ...contact, identifier: "not-an-address", identifierType: "evm" },
          {
            ...contact,
            identifier: "Vote111111111111111111111111111111111111111",
            identifierType: "solana",
          },
        ],
      }),
    );
    expect(readDaimoWithdrawalContacts(storage)).toEqual([]);
  });

  it("does not block when contact storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
    };
    expect(saveDaimoWithdrawalContact(contact, storage)).toEqual([contact]);
  });

  it("keeps case-sensitive Solana contacts distinct", () => {
    const storage = createStorage();
    const solanaContact: DaimoWithdrawalContact = {
      identifier: "Vote111111111111111111111111111111111111111",
      identifierType: "solana",
      asset: "USDC",
      chainId: solana.chainId,
      lastUsedAt: 10,
    };
    saveDaimoWithdrawalContact(solanaContact, storage);
    saveDaimoWithdrawalContact(
      {
        ...solanaContact,
        identifier: "Wote111111111111111111111111111111111111111",
        lastUsedAt: 20,
      },
      storage,
    );
    expect(readDaimoWithdrawalContacts(storage)).toHaveLength(2);
  });
});

describe("manual withdrawal session", () => {
  it("initializes one hidden receiver and reuses it after adapter rejection", async () => {
    const createPaymentMethod = vi.fn().mockResolvedValue({
      session: {
        sessionId: "session-1",
        status: "waiting_payment",
        paymentMethod: {
          type: "evm",
          receiverAddress: RECEIVER_ADDRESS,
          createdAt: 1,
        },
        expiresAt: 100,
      },
    });
    const adapter = vi
      .fn()
      .mockRejectedValueOnce(new Error("cancelled"))
      .mockResolvedValueOnce({ txHash: "0x1234" });
    const destination = {
      type: "evm" as const,
      address: EVM_ADDRESS,
      chainId: 8453,
      tokenAddress: getAddress(baseUSDC.token),
    };
    const client = {
      sessions: { paymentMethods: { create: createPaymentMethod } },
    } as unknown as DaimoClient;
    const controller = new ManualWithdrawalSession(
      client,
      "session-1",
      "secret-1",
      destination,
      adapter,
    );

    await expect(controller.start()).rejects.toThrow("cancelled");
    await expect(controller.start()).resolves.toMatchObject({
      txHash: "0x1234",
    });
    expect(createPaymentMethod).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter).toHaveBeenLastCalledWith({
      sessionId: "session-1",
      receiverAddress: RECEIVER_ADDRESS,
      destination,
      expiresAt: 100,
    });
  });

  it("deduplicates concurrent and completed adapter calls", async () => {
    const createPaymentMethod = vi.fn().mockResolvedValue({
      session: {
        sessionId: "session-1",
        status: "waiting_payment",
        paymentMethod: {
          type: "evm",
          receiverAddress: RECEIVER_ADDRESS,
          createdAt: 1,
        },
        expiresAt: 100,
      },
    });
    const adapter = vi.fn().mockResolvedValue({});
    const client = {
      sessions: { paymentMethods: { create: createPaymentMethod } },
    } as unknown as DaimoClient;
    const controller = new ManualWithdrawalSession(
      client,
      "session-1",
      "secret-1",
      {
        type: "evm",
        address: EVM_ADDRESS,
        chainId: 8453,
        tokenAddress: getAddress(baseUSDC.token),
      },
      adapter,
    );

    await Promise.all([controller.start(), controller.start()]);
    await controller.start();
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("retries payment-method initialization after a transient failure", async () => {
    const createPaymentMethod = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({
        session: {
          sessionId: "session-1",
          status: "waiting_payment",
          paymentMethod: {
            type: "evm",
            receiverAddress: RECEIVER_ADDRESS,
            createdAt: 1,
          },
          expiresAt: 100,
        },
      });
    const adapter = vi.fn().mockResolvedValue({});
    const client = {
      sessions: { paymentMethods: { create: createPaymentMethod } },
    } as unknown as DaimoClient;
    const controller = new ManualWithdrawalSession(
      client,
      "session-1",
      "secret-1",
      {
        type: "evm",
        address: EVM_ADDRESS,
        chainId: 8453,
        tokenAddress: getAddress(baseUSDC.token),
      },
      adapter,
    );

    await expect(controller.start()).rejects.toThrow("network unavailable");
    await expect(controller.start()).resolves.toMatchObject({
      session: { sessionId: "session-1" },
    });
    expect(createPaymentMethod).toHaveBeenCalledTimes(2);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

function createStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
  };
}
