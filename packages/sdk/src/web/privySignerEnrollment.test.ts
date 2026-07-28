import { describe, expect, test, vi } from "vitest";
import { getAddress } from "viem";

import type {
  PrivySignerEnrollment,
  PrivyWalletIdentity,
} from "../common/account.js";
import {
  authorizePrivyWallet,
  checkPrivyWalletSignerEnrollment,
  type PrivySignerEnrollmentClientState,
} from "./privySignerEnrollment.js";

const CONFIG = {
  quorumId: "quorum-daimo",
  policyId: "policy-send-transaction",
};
const WALLET_ONE: PrivyWalletIdentity = {
  walletId: "wallet-one",
  walletAddress: getAddress("0x1234567890abcdef1234567890abcdef12345678"),
};
const WALLET_TWO: PrivyWalletIdentity = {
  walletId: "wallet-two",
  walletAddress: getAddress("0x0000000000000000000000000000000000000020"),
};

describe("Privy signer enrollment", () => {
  test("adds and confirms the configured signer for a new wallet", async () => {
    const confirm = vi
      .fn()
      .mockResolvedValueOnce(enrollment(WALLET_ONE, "revoked"))
      .mockResolvedValueOnce(enrollment(WALLET_ONE, "active"));
    const addSigners = vi.fn().mockResolvedValue(undefined);

    const result = await authorizePrivyWallet({
      wallet: WALLET_ONE,
      config: CONFIG,
      confirm,
      addSigners,
    });

    expect(addSigners).toHaveBeenCalledOnce();
    expect(addSigners).toHaveBeenCalledWith({
      walletAddress: WALLET_ONE.walletAddress,
      quorumId: CONFIG.quorumId,
      policyId: CONFIG.policyId,
    });
    expect(confirm).toHaveBeenNthCalledWith(1, WALLET_ONE.walletId);
    expect(confirm).toHaveBeenNthCalledWith(2, WALLET_ONE.walletId);
    expect(result).toMatchObject({ status: "active" });
  });

  test("keeps independent state for multiple selected wallets", async () => {
    const states: Record<string, PrivySignerEnrollmentClientState> = {};
    const addSigners = vi.fn().mockResolvedValue(undefined);

    states[WALLET_ONE.walletId] = await checkPrivyWalletSignerEnrollment({
      wallet: WALLET_ONE,
      confirm: async () => enrollment(WALLET_ONE, "active"),
    });
    states[WALLET_TWO.walletId] = await authorizePrivyWallet({
      wallet: WALLET_TWO,
      config: CONFIG,
      confirm: vi
        .fn()
        .mockResolvedValueOnce(enrollment(WALLET_TWO, "revoked"))
        .mockResolvedValueOnce(enrollment(WALLET_TWO, "active")),
      addSigners,
    });

    expect(states).toMatchObject({
      "wallet-one": { status: "active" },
      "wallet-two": { status: "active" },
    });
    expect(addSigners).toHaveBeenCalledWith(
      expect.objectContaining({ walletAddress: WALLET_TWO.walletAddress }),
    );
  });

  test("returning active wallets skip duplicate signer additions", async () => {
    const addSigners = vi.fn().mockResolvedValue(undefined);

    const result = await authorizePrivyWallet({
      wallet: WALLET_ONE,
      config: CONFIG,
      confirm: async () => enrollment(WALLET_ONE, "active"),
      addSigners,
    });

    expect(result.status).toBe("active");
    expect(addSigners).not.toHaveBeenCalled();
  });

  test("pending wallets remain scoped and do not add duplicate signers", async () => {
    const addSigners = vi.fn().mockResolvedValue(undefined);

    const result = await authorizePrivyWallet({
      wallet: WALLET_ONE,
      config: CONFIG,
      confirm: async () => enrollment(WALLET_ONE, "pending"),
      addSigners,
    });

    expect(result).toMatchObject({
      status: "pending",
      enrollment: { walletId: WALLET_ONE.walletId },
    });
    expect(addSigners).not.toHaveBeenCalled();
  });

  test("rejects a confirmation for a different wallet", async () => {
    const addSigners = vi.fn().mockResolvedValue(undefined);

    const result = await authorizePrivyWallet({
      wallet: WALLET_ONE,
      config: CONFIG,
      confirm: async () => enrollment(WALLET_TWO, "active"),
      addSigners,
    });

    expect(result).toMatchObject({
      status: "failed",
      error: "privy wallet confirmation mismatch",
    });
    expect(addSigners).not.toHaveBeenCalled();
  });

  test("accepts confirmation address casing differences", async () => {
    const wallet = {
      ...WALLET_ONE,
      walletAddress:
        "0x1234567890abcdef1234567890abcdef12345678" as const,
    };

    const result = await checkPrivyWalletSignerEnrollment({
      wallet,
      confirm: async () => enrollment(WALLET_ONE, "active"),
    });

    expect(result).toMatchObject({ status: "active" });
  });

  test("a later authorization can re-add a still-revoked signer", async () => {
    const addSigners = vi.fn().mockResolvedValue(undefined);
    const first = await authorizePrivyWallet({
      wallet: WALLET_ONE,
      config: CONFIG,
      confirm: vi
        .fn()
        .mockResolvedValueOnce(enrollment(WALLET_ONE, "revoked"))
        .mockRejectedValueOnce(new Error("verification unavailable")),
      addSigners,
    });

    expect(first).toMatchObject({ status: "failed" });

    const retried = await authorizePrivyWallet({
      wallet: WALLET_ONE,
      config: CONFIG,
      confirm: vi
        .fn()
        .mockResolvedValueOnce(enrollment(WALLET_ONE, "revoked"))
        .mockResolvedValueOnce(enrollment(WALLET_ONE, "active")),
      addSigners,
    });

    expect(retried.status).toBe("active");
    expect(addSigners).toHaveBeenCalledTimes(2);
  });

  test("revoked wallets re-enable only the selected wallet", async () => {
    const addSigners = vi.fn().mockResolvedValue(undefined);
    const confirm = vi
      .fn()
      .mockResolvedValueOnce(enrollment(WALLET_TWO, "revoked"))
      .mockResolvedValueOnce(enrollment(WALLET_TWO, "active"));

    await authorizePrivyWallet({
      wallet: WALLET_TWO,
      config: CONFIG,
      confirm,
      addSigners,
    });

    expect(confirm).toHaveBeenCalledWith(WALLET_TWO.walletId);
    expect(confirm).not.toHaveBeenCalledWith(WALLET_ONE.walletId);
    expect(addSigners).toHaveBeenCalledWith(
      expect.objectContaining({ walletAddress: WALLET_TWO.walletAddress }),
    );
  });
});

function enrollment(
  wallet: PrivyWalletIdentity,
  status: PrivySignerEnrollment["status"],
): PrivySignerEnrollment {
  return {
    ...wallet,
    status,
    signerVersion: status === "active" ? 1 : null,
    lastVerifiedAt: "2026-07-23T00:00:00.000Z",
  };
}
