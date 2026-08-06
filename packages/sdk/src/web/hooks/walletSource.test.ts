import { describe, expect, it, vi } from "vitest";

import type { InjectedWallet } from "./useInjectedWallets.js";
import type { EthereumProvider, SolanaProvider } from "./walletProvider.js";
import { filterInjectedWalletsBySource } from "./walletSource.js";

describe("wallet source filtering", () => {
  const evmRequest = vi.fn(async () => []);
  const solanaConnect = vi.fn(async () => ({
    publicKey: { toBase58: () => "solana-address" },
  }));
  const solanaSend = vi.fn(async () => ({ signature: "signature" }));
  const evmProvider: EthereumProvider = { request: evmRequest };
  const solanaProvider: SolanaProvider = {
    publicKey: null,
    connect: solanaConnect,
    signAndSendTransaction: solanaSend,
  };
  const wallets: InjectedWallet[] = [
    {
      info: walletInfo("evm"),
      evmProvider,
    },
    {
      info: walletInfo("solana"),
      solanaProvider,
    },
    {
      info: walletInfo("dual"),
      evmProvider,
      solanaProvider,
    },
  ];

  it("preserves mixed wallets by default", () => {
    expect(filterInjectedWalletsBySource(wallets, "all")).toBe(wallets);
  });

  it("keeps only the EVM side of eligible wallets", async () => {
    const filtered = filterInjectedWalletsBySource(wallets, "evm");

    expect(filtered).toEqual([
      { info: walletInfo("evm"), evmProvider },
      { info: walletInfo("dual"), evmProvider },
    ]);
    expect(filtered.every((wallet) => wallet.solanaProvider == null)).toBe(
      true,
    );

    await Promise.all(
      filtered.map((wallet) =>
        wallet.evmProvider?.request({ method: "eth_requestAccounts" }),
      ),
    );
    expect(evmRequest).toHaveBeenCalledTimes(2);
    expect(solanaConnect).not.toHaveBeenCalled();
    expect(solanaSend).not.toHaveBeenCalled();
  });
});

function walletInfo(name: string) {
  return {
    name,
    icon: "",
    rdns: `test.${name}`,
    uuid: `test-${name}`,
  };
}
