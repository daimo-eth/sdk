import type { InjectedWallet } from "./useInjectedWallets.js";

export type DaimoWalletSource = "all" | "evm";

/** Remove providers that cannot fund the selected wallet source. */
export function filterInjectedWalletsBySource(
  wallets: InjectedWallet[],
  walletSource: DaimoWalletSource,
): InjectedWallet[] {
  if (walletSource === "all") return wallets;

  return wallets.flatMap(({ info, evmProvider }) =>
    evmProvider ? [{ info, evmProvider }] : [],
  );
}
