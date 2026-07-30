import { getAddress, isAddress } from "viem";

export type PrivyWalletLike = {
  id?: string | null;
  type?: string | null;
  chainType?: string | null;
  walletClientType?: string | null;
  address?: string | null;
  walletIndex?: number | null;
};

export const CANONICAL_PRIVY_WALLET_INDEX = 0;

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
