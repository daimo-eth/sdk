import { getAddress } from "viem";

import type {
  CreateAccountResponse,
  EnsureAccountWalletResponse,
  GetAccountResponse,
  PrivySignerConfig,
  PrivyWalletIdentity,
} from "../common/account.js";
import type { PrivySignerEnrollmentClientState } from "./privySignerEnrollment.js";

type ExistingAccountResponse = Exclude<GetAccountResponse, { account: null }>;

type AccountSignerOperations = {
  getAccount: () => Promise<GetAccountResponse | null>;
  createAccount: (walletAddress: string) => Promise<CreateAccountResponse>;
  ensureWallet: () => Promise<EnsureAccountWalletResponse>;
  resolveWallet: (walletAddress: string) => Promise<PrivyWalletIdentity | null>;
  authorizeWalletSigner: (
    wallet: PrivyWalletIdentity,
    signerConfig: PrivySignerConfig,
  ) => Promise<PrivySignerEnrollmentClientState>;
  onEnrollmentUnavailable?: (state: PrivySignerEnrollmentClientState) => void;
};

/** Require signer authorization only when both session and server enable it. */
export function requiresPrivySignerAuthorization(
  response: GetAccountResponse,
  signerConfig: PrivySignerConfig | null,
): boolean {
  return (
    signerConfig != null &&
    response.account != null &&
    response.signerReadiness === "required"
  );
}

/** Prepare one Account wallet and enroll its configured signer when requested. */
export async function prepareAccountSigner(args: {
  initialResponse?: GetAccountResponse;
  authorizeSigner: boolean;
  signerConfig: PrivySignerConfig | null;
  operations: AccountSignerOperations;
}): Promise<ExistingAccountResponse> {
  const { operations } = args;
  const initial = args.initialResponse ?? (await operations.getAccount());
  if (!initial) throw new Error("failed to load account");

  if (initial.account) {
    const wallet = await operations.resolveWallet(
      initial.account.walletAddress,
    );
    if (wallet) {
      await enrollSigner(
        args.authorizeSigner,
        args.signerConfig,
        wallet,
        operations,
      );
    } else if (args.authorizeSigner && args.signerConfig) {
      operations.onEnrollmentUnavailable?.(walletIdentityUnavailable());
    }
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
  await enrollSigner(
    args.authorizeSigner,
    args.signerConfig,
    wallet,
    operations,
  );

  const response = await operations.getAccount();
  if (!response?.account) throw new Error("account not found");
  return response;
}

async function enrollSigner(
  authorized: boolean,
  signerConfig: PrivySignerConfig | null,
  wallet: EnsureAccountWalletResponse,
  operations: AccountSignerOperations,
) {
  if (!authorized || !signerConfig) return;
  if (!wallet.walletId) {
    operations.onEnrollmentUnavailable?.(walletIdentityUnavailable());
    return;
  }
  let state: PrivySignerEnrollmentClientState;
  try {
    state = await operations.authorizeWalletSigner(
      {
        walletId: wallet.walletId,
        walletAddress: wallet.walletAddress,
      },
      signerConfig,
    );
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

function walletIdentityUnavailable(): PrivySignerEnrollmentClientState {
  return {
    status: "failed",
    error: "wallet identity unavailable",
  };
}
