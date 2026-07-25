import { getAddress } from "viem";

import type {
  PrivySignerConfig,
  PrivySignerEnrollment,
  PrivyWalletIdentity,
} from "../common/account.js";

export type PrivySignerEnrollmentClientStatus =
  | "pending"
  | "active"
  | "revoked"
  | "failed";

export type PrivySignerEnrollmentClientState = {
  status: PrivySignerEnrollmentClientStatus;
  enrollment?: PrivySignerEnrollment;
  error?: string;
};

type AuthorizePrivyWalletArgs = {
  wallet: PrivyWalletIdentity;
  config: PrivySignerConfig;
  confirm: (walletId: string) => Promise<PrivySignerEnrollment>;
  addSigners: (args: {
    walletAddress: PrivyWalletIdentity["walletAddress"];
    quorumId: string;
    policyId: string;
  }) => Promise<void>;
};

/** Check one wallet without granting signer permissions. */
export async function checkPrivyWalletSignerEnrollment(args: {
  wallet: PrivyWalletIdentity;
  confirm: (walletId: string) => Promise<PrivySignerEnrollment>;
}): Promise<PrivySignerEnrollmentClientState> {
  try {
    const enrollment = await args.confirm(args.wallet.walletId);
    if (
      enrollment.walletId !== args.wallet.walletId ||
      getAddress(enrollment.walletAddress) !==
        getAddress(args.wallet.walletAddress)
    ) {
      throw new Error("privy wallet confirmation mismatch");
    }
    return stateFromEnrollment(enrollment);
  } catch (error) {
    return failedState(error);
  }
}

/**
 * Add the configured signer only after an authoritative preflight, then require
 * backend confirmation before returning active.
 */
export async function authorizePrivyWallet(
  args: AuthorizePrivyWalletArgs,
): Promise<PrivySignerEnrollmentClientState> {
  const checked = await checkPrivyWalletSignerEnrollment({
    wallet: args.wallet,
    confirm: args.confirm,
  });
  if (
    checked.status === "active" ||
    checked.status === "pending" ||
    checked.status === "failed"
  )
    return checked;

  try {
    await args.addSigners({
      walletAddress: args.wallet.walletAddress,
      quorumId: args.config.quorumId,
      policyId: args.config.policyId,
    });
  } catch (error) {
    return reconcileFailedAddition(args, error);
  }

  return checkPrivyWalletSignerEnrollment({
    wallet: args.wallet,
    confirm: args.confirm,
  });
}

function stateFromEnrollment(
  enrollment: PrivySignerEnrollment,
): PrivySignerEnrollmentClientState {
  if (enrollment.status === "active") {
    return { status: "active", enrollment };
  }
  if (enrollment.status === "pending") {
    return { status: "pending", enrollment };
  }
  if (enrollment.status === "error") {
    return {
      status: "failed",
      enrollment,
      error: "failed to verify automatic routing",
    };
  }
  return {
    status: "revoked",
    enrollment,
  };
}

async function reconcileFailedAddition(
  args: AuthorizePrivyWalletArgs,
  error: unknown,
): Promise<PrivySignerEnrollmentClientState> {
  const reconciled = await checkPrivyWalletSignerEnrollment({
    wallet: args.wallet,
    confirm: args.confirm,
  });
  return reconciled.status === "active" ? reconciled : failedState(error);
}

function failedState(error: unknown): PrivySignerEnrollmentClientState {
  return {
    status: "failed",
    error:
      error instanceof Error && error.message
        ? error.message
        : "failed to enable automatic routing",
  };
}
