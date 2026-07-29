import type { Address } from "viem";
import { getAddress, isAddress } from "viem";

import type { PrivyWalletIdentity } from "../common/account.js";

export type PrivyWalletLike = {
  id?: string | null;
  type?: string | null;
  chainType?: string | null;
  walletClientType?: string | null;
  address?: string | null;
  walletIndex?: number | null;
};

export const CANONICAL_PRIVY_WALLET_INDEX = 0;

export class AccountWalletNotReadyError extends Error {
  constructor(options?: ErrorOptions) {
    super("wallet is still initializing. please try again", options);
    this.name = "AccountWalletNotReadyError";
  }
}

export function isAccountWalletNotReadyError(
  error: unknown,
): error is AccountWalletNotReadyError {
  return error instanceof AccountWalletNotReadyError;
}

export function getCanonicalPrivyWalletAddress({
  userWalletAddress,
  linkedAccounts,
  connectedWallets,
}: {
  userWalletAddress: string | null | undefined;
  linkedAccounts: readonly PrivyWalletLike[];
  connectedWallets: readonly PrivyWalletLike[];
}): string | null {
  const indexedWallet =
    linkedAccounts.find(isCanonicalPrivyWallet) ??
    connectedWallets.find(isCanonicalPrivyWallet);
  if (indexedWallet?.address) return indexedWallet.address;
  if (userWalletAddress) return userWalletAddress;

  const onlyEmbeddedWallet = getSinglePrivyEmbeddedWallet([
    ...linkedAccounts,
    ...connectedWallets,
  ]);
  return onlyEmbeddedWallet?.address ?? null;
}

export function hasPrivyEmbeddedWallet(
  wallets: readonly PrivyWalletLike[],
): boolean {
  return wallets.some(isPrivyEmbeddedWallet);
}

/** List exact embedded EVM wallet IDs and addresses without picking a default. */
export function listPrivyEmbeddedWallets(
  wallets: readonly PrivyWalletLike[],
): PrivyWalletIdentity[] {
  const byId = new Map<string, Address>();
  const conflictingIds = new Set<string>();
  for (const wallet of wallets) {
    if (
      !isPrivyEmbeddedWallet(wallet) ||
      wallet.chainType !== "ethereum" ||
      !wallet.id ||
      !wallet.address ||
      !isAddress(wallet.address)
    ) {
      continue;
    }
    const address = getAddress(wallet.address);
    const existing = byId.get(wallet.id);
    if (existing && existing !== address) {
      conflictingIds.add(wallet.id);
      continue;
    }
    byId.set(wallet.id, address);
  }
  return [...byId]
    .filter(([walletId]) => !conflictingIds.has(walletId))
    .map(([walletId, walletAddress]) => ({ walletId, walletAddress }));
}

/** Resolve the only embedded wallet bound to one Account address. */
export function findPrivyEmbeddedWalletByAddress(
  wallets: readonly PrivyWalletIdentity[],
  walletAddress: string,
): PrivyWalletIdentity | null {
  if (!isAddress(walletAddress)) return null;
  const expectedAddress = getAddress(walletAddress);
  const matches = wallets.filter(
    (wallet) => getAddress(wallet.walletAddress) === expectedAddress,
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function findCanonicalPrivyWallet<T extends PrivyWalletLike>(
  wallets: readonly T[],
  canonicalWalletAddress: string | null,
): T | null {
  if (!canonicalWalletAddress || !isAddress(canonicalWalletAddress)) {
    return null;
  }
  const expectedAddress = getAddress(canonicalWalletAddress);
  return (
    wallets.find(
      (wallet) =>
        isPrivyEmbeddedWallet(wallet) &&
        wallet.address &&
        isAddress(wallet.address) &&
        getAddress(wallet.address) === expectedAddress,
    ) ?? null
  );
}

/** Return the connected canonical wallet only after Privy has settled wallets. */
export function getReadyCanonicalPrivyWalletAddress({
  ready,
  wallets,
  canonicalWalletAddress,
}: {
  ready: boolean;
  wallets: readonly PrivyWalletLike[];
  canonicalWalletAddress: string | null;
}): Address | null {
  if (!ready) return null;
  const wallet = findCanonicalPrivyWallet(wallets, canonicalWalletAddress);
  return wallet?.address && isAddress(wallet.address)
    ? getAddress(wallet.address)
    : null;
}

function isCanonicalPrivyWallet(wallet: PrivyWalletLike): boolean {
  return (
    isPrivyEmbeddedWallet(wallet) &&
    wallet.walletIndex === CANONICAL_PRIVY_WALLET_INDEX
  );
}

function isPrivyEmbeddedWallet(wallet: PrivyWalletLike): boolean {
  return (
    wallet.walletClientType === "privy" ||
    wallet.walletClientType === "privy-v2"
  );
}

function getSinglePrivyEmbeddedWallet(
  wallets: readonly PrivyWalletLike[],
): PrivyWalletLike | null {
  const addresses = new Set<string>();
  const embeddedWallets = wallets.filter((wallet) => {
    if (!isPrivyEmbeddedWallet(wallet) || !wallet.address) return false;
    if (addresses.has(wallet.address)) return false;
    addresses.add(wallet.address);
    return true;
  });
  return embeddedWallets.length === 1 ? embeddedWallets[0] : null;
}
