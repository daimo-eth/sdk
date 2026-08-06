import { getAddress, isAddress, type Address } from "viem";

import { getChainById, solana } from "./chain.js";
import type { SolanaAddress } from "./primitives.js";
import { zSolanaAddress } from "./primitives.js";
import {
  arbitrumUSDC,
  arbitrumUSDT0,
  baseUSDC,
  baseUSDT,
  bscUSDC,
  bscUSDT,
  ethereumUSDC,
  ethereumUSDT,
  hyperEvmUSDC,
  optimismUSDC,
  optimismUSDT,
  polygonUSDC,
  polygonUSDT0,
  solanaUSDC,
  type Token,
} from "./token.js";

export type DaimoWithdrawalFundingMode = "injected-wallet" | "manual";

export type DaimoWithdrawalDestination =
  | {
      type: "evm";
      address: Address;
      chainId: number;
      tokenAddress: Address;
    }
  | {
      type: "solana";
      address: SolanaAddress;
      tokenAddress: SolanaAddress;
    };

export type DaimoWithdrawalDestinationAsset = "USDC" | "USDT";

export type DaimoWithdrawalDestinationRoute = {
  asset: DaimoWithdrawalDestinationAsset;
  chainId: number;
  chainName: string;
  tokenAddress: string;
  tokenLogoURI: string;
};

/** Withdrawal tokens approved against production send limits. */
const withdrawalDestinationTokens: readonly Token[] = [
  arbitrumUSDC,
  arbitrumUSDT0,
  baseUSDC,
  baseUSDT,
  bscUSDC,
  bscUSDT,
  ethereumUSDC,
  ethereumUSDT,
  hyperEvmUSDC,
  optimismUSDC,
  optimismUSDT,
  polygonUSDC,
  polygonUSDT0,
  solanaUSDC,
];

/** Stablecoin routes supported by the withdrawal destination picker. */
export const daimoWithdrawalDestinationRoutes = withdrawalDestinationTokens.map(
  toWithdrawalDestinationRoute,
);

/** Returns whether a destination matches one of the SDK's supported routes. */
export function isDaimoWithdrawalDestination(
  destination: DaimoWithdrawalDestination,
): boolean {
  if (destination.type === "solana") {
    if (!zSolanaAddress.safeParse(destination.address).success) return false;
    if (!zSolanaAddress.safeParse(destination.tokenAddress).success)
      return false;
    return daimoWithdrawalDestinationRoutes.some(
      (route) =>
        route.chainId === solana.chainId &&
        route.tokenAddress === destination.tokenAddress,
    );
  }

  if (!isAddress(destination.address) || !isAddress(destination.tokenAddress)) {
    return false;
  }
  const tokenAddress = getAddress(destination.tokenAddress);
  return daimoWithdrawalDestinationRoutes.some(
    (route) =>
      route.chainId === destination.chainId &&
      route.tokenAddress === tokenAddress,
  );
}

export function getDaimoWithdrawalDestinationRoute(
  asset: DaimoWithdrawalDestinationAsset,
  chainId: number,
): DaimoWithdrawalDestinationRoute | undefined {
  return daimoWithdrawalDestinationRoutes.find(
    (route) => route.asset === asset && route.chainId === chainId,
  );
}

function toWithdrawalDestinationRoute(
  token: Token,
): DaimoWithdrawalDestinationRoute {
  return {
    asset: token.symbol === "USDC" ? "USDC" : "USDT",
    chainId: token.chainId,
    chainName: getChainById(token.chainId).name,
    tokenAddress: token.token,
    tokenLogoURI: token.logoURI,
  };
}
