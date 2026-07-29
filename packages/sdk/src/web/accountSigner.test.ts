import { describe, expect, test, vi } from "vitest";
import { getAddress } from "viem";

import type {
  EnsureAccountWalletResponse,
  GetAccountResponse,
  PrivyWalletIdentity,
} from "../common/account.js";
import { prepareAccountSigner } from "./accountSigner.js";

const WALLET: PrivyWalletIdentity = {
  walletId: "wallet-one",
  walletAddress: getAddress("0x1234567890abcdef1234567890abcdef12345678"),
};
const SIGNER_CONFIG = {
  quorumId: "quorum-daimo",
  policyId: "policy-send-transaction",
};
const ACCOUNT: Exclude<GetAccountResponse, { account: null }> = {
  account: {
    id: "account-one",
    email: "test@example.com",
    walletAddress: WALLET.walletAddress,
  },
  nextAction: "enrollment",
};

describe("prepareAccountSigner", () => {
  test("reuses the initial Account response and does not reauthorize a restored session", async () => {
    const operations = makeOperations();

    await expect(
      prepareAccountSigner({
        initialResponse: ACCOUNT,
        authorizeSigner: false,
        signerConfig: SIGNER_CONFIG,
        operations,
      }),
    ).resolves.toEqual(ACCOUNT);

    expect(operations.getAccount).not.toHaveBeenCalled();
    expect(operations.authorizeWalletSigner).not.toHaveBeenCalled();
  });

  test("authorizes the exact Account wallet with session signer config", async () => {
    const operations = makeOperations();

    await prepareAccountSigner({
      initialResponse: ACCOUNT,
      authorizeSigner: true,
      signerConfig: SIGNER_CONFIG,
      operations,
    });

    expect(operations.authorizeWalletSigner).toHaveBeenCalledWith(
      WALLET,
      SIGNER_CONFIG,
    );
  });

  test("keeps legacy Account access when no embedded wallet matches", async () => {
    const operations = makeOperations({ embeddedWallets: [] });

    await expect(
      prepareAccountSigner({
        initialResponse: ACCOUNT,
        authorizeSigner: true,
        signerConfig: SIGNER_CONFIG,
        operations,
      }),
    ).resolves.toEqual(ACCOUNT);

    expect(operations.authorizeWalletSigner).not.toHaveBeenCalled();
  });

  test("does not block Account access when signer enrollment fails", async () => {
    const operations = makeOperations();
    operations.authorizeWalletSigner.mockRejectedValue(
      new Error("privy unavailable"),
    );

    await expect(
      prepareAccountSigner({
        initialResponse: ACCOUNT,
        authorizeSigner: true,
        signerConfig: SIGNER_CONFIG,
        operations,
      }),
    ).resolves.toEqual(ACCOUNT);

    expect(operations.onEnrollmentUnavailable).toHaveBeenCalledWith({
      status: "failed",
      error: "privy unavailable",
    });
  });

  test("uses the server-provisioned wallet for a new Account", async () => {
    const operations = makeOperations({
      embeddedWallets: [],
      getAccountResults: [
        { account: null, nextAction: "create_account" },
        ACCOUNT,
      ],
    });

    await expect(
      prepareAccountSigner({
        authorizeSigner: true,
        signerConfig: SIGNER_CONFIG,
        operations,
      }),
    ).resolves.toEqual(ACCOUNT);

    expect(operations.ensureWallet).toHaveBeenCalledOnce();
    expect(operations.createAccount).toHaveBeenCalledWith(WALLET.walletAddress);
    expect(operations.authorizeWalletSigner).toHaveBeenCalledWith(
      WALLET,
      SIGNER_CONFIG,
    );
  });

  test("supports a legacy ensure response when session signer config is absent", async () => {
    const operations = makeOperations({
      ensuredWallet: { walletAddress: WALLET.walletAddress },
      embeddedWallets: [],
      getAccountResults: [
        { account: null, nextAction: "create_account" },
        ACCOUNT,
      ],
    });

    await expect(
      prepareAccountSigner({
        authorizeSigner: true,
        signerConfig: null,
        operations,
      }),
    ).resolves.toEqual(ACCOUNT);

    expect(operations.createAccount).toHaveBeenCalledWith(WALLET.walletAddress);
    expect(operations.authorizeWalletSigner).not.toHaveBeenCalled();
    expect(operations.onEnrollmentUnavailable).not.toHaveBeenCalled();
  });

  test("does not block account access when wallet identity is unavailable", async () => {
    const operations = makeOperations({
      ensuredWallet: { walletAddress: WALLET.walletAddress },
      embeddedWallets: [],
      getAccountResults: [
        { account: null, nextAction: "create_account" },
        ACCOUNT,
      ],
    });

    await expect(
      prepareAccountSigner({
        authorizeSigner: true,
        signerConfig: SIGNER_CONFIG,
        operations,
      }),
    ).resolves.toEqual(ACCOUNT);

    expect(operations.authorizeWalletSigner).not.toHaveBeenCalled();
    expect(operations.onEnrollmentUnavailable).toHaveBeenCalledWith({
      status: "failed",
      error: "wallet identity unavailable",
    });
  });
});

function makeOperations({
  embeddedWallets = [WALLET],
  getAccountResults = [ACCOUNT],
  ensuredWallet = WALLET,
}: {
  embeddedWallets?: readonly PrivyWalletIdentity[];
  getAccountResults?: GetAccountResponse[];
  ensuredWallet?: EnsureAccountWalletResponse;
} = {}) {
  return {
    embeddedWallets,
    getAccount: vi
      .fn<() => Promise<GetAccountResponse | null>>()
      .mockImplementation(async () => getAccountResults.shift() ?? null),
    createAccount: vi.fn(async () => ({ account: ACCOUNT.account })),
    ensureWallet: vi.fn(async () => ensuredWallet),
    authorizeWalletSigner: vi.fn(async () => ({
      status: "active" as const,
      enrollment: {
        ...WALLET,
        status: "active" as const,
        signerVersion: 1,
        lastVerifiedAt: "2026-07-24T00:00:00.000Z",
      },
    })),
    onEnrollmentUnavailable: vi.fn(),
  };
}
