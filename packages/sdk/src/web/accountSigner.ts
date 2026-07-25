import { getAddress } from "viem";

import type {
  CreateAccountResponse,
  EnsureAccountWalletResponse,
  GetAccountResponse,
  PrivyWalletIdentity,
} from "../common/account.js";
import { findPrivyEmbeddedWalletByAddress } from "./accountWallet.js";
import type { PrivySignerEnrollmentClientState } from "./privySignerEnrollment.js";

type ExistingAccountResponse = Exclude<GetAccountResponse, { account: null }>;

type AccountSignerOperations = {
  embeddedWallets: readonly PrivyWalletIdentity[];
  signerConfigured: boolean;
  getAccount: () => Promise<GetAccountResponse | null>;
  createAccount: (walletAddress: string) => Promise<CreateAccountResponse>;
  ensureWallet: () => Promise<EnsureAccountWalletResponse>;
  authorizeWalletSigner: (
    wallet: PrivyWalletIdentity,
  ) => Promise<PrivySignerEnrollmentClientState>;
  onEnrollmentUnavailable?: (state: PrivySignerEnrollmentClientState) => void;
};

/** Prepare one Account wallet and optionally enroll its signer after consent. */
export async function prepareAccountSigner(args: {
  initialResponse?: GetAccountResponse;
  authorizeSigner: boolean;
  operations: AccountSignerOperations;
}): Promise<ExistingAccountResponse> {
  const { operations } = args;
  const initial = args.initialResponse ?? (await operations.getAccount());
  if (!initial) throw new Error("failed to load account");

  if (initial.account) {
    const wallet = findPrivyEmbeddedWalletByAddress(
      operations.embeddedWallets,
      initial.account.walletAddress,
    );
    if (wallet) await enrollSigner(args.authorizeSigner, wallet, operations);
    return initial;
  }

  const wallet = await operations.ensureWallet();
  const created = await operations.createAccount(wallet.walletAddress);
  if (
    getAddress(created.account.walletAddress) !==
    getAddress(wallet.walletAddress)
  ) {
    throw new Error("account wallet identity mismatch");
  }
  await enrollSigner(args.authorizeSigner, wallet, operations);

  const response = await operations.getAccount();
  if (!response?.account) throw new Error("account not found");
  return response;
}

async function enrollSigner(
  authorized: boolean,
  wallet: EnsureAccountWalletResponse,
  operations: AccountSignerOperations,
) {
  if (!authorized || !operations.signerConfigured) return;
  if (!wallet.walletId) {
    operations.onEnrollmentUnavailable?.({
      status: "failed",
      error: "wallet identity unavailable",
    });
    return;
  }
  let state: PrivySignerEnrollmentClientState;
  try {
    state = await operations.authorizeWalletSigner({
      walletId: wallet.walletId,
      walletAddress: wallet.walletAddress,
    });
  } catch (error) {
    state = {
      status: "failed",
      error:
        error instanceof Error && error.message
          ? error.message
          : "failed to enable automatic routing",
    };
  }
  if (state.status !== "active") operations.onEnrollmentUnavailable?.(state);
}
