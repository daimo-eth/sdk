/**
 * AccountFlowProvider: wraps PrivyProvider + AccountFlowContext.
 *
 * Renders PrivyProvider with the given appId. Inside, PrivyConsumer
 * reads Privy hooks and registers them with the account flow state.
 */
import {
  PrivyProvider,
  useLoginWithEmail,
  usePrivy,
  useSendTransaction,
  useSigners,
  useUser,
  useWallets,
} from "@privy-io/react-auth";
import { type ReactNode, useCallback, useEffect, useMemo } from "react";

import type { DaimoClient } from "../../../client/createDaimoClient.js";
import {
  AccountFlowContext,
  useAccountFlowState,
} from "../../hooks/useAccountFlow.js";
import {
  findCanonicalPrivyWallet,
  getCanonicalPrivyWalletAddress,
  listPrivyEmbeddedWallets,
} from "../../accountWallet.js";

// EIP-6963 provider info for the announced embedded wallet: white Daimo
// asterisk on brand green.
const EMBEDDED_WALLET_INFO = Object.freeze({
  uuid: "430f5fc7-9949-4558-b021-4012543433aa",
  name: "Daimo",
  icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgMzAwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgcng9IjY0IiBmaWxsPSIjMDA5MTEwIi8+PGcgc3Ryb2tlPSIjRkZGIiBzdHJva2Utd2lkdGg9IjM0IiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxwYXRoIGQ9Ik0xODAgMjAyIDEyMCA5OCIvPjxwYXRoIGQ9Ik0yMTAgMTUwIDkwIDE1MCIvPjxwYXRoIGQ9Ik0xODAgOTggMTIwIDIwMiIvPjwvZz48L3N2Zz4=",
  rdns: "com.daimo",
});

type AccountFlowProviderProps = {
  privyAppId: string;
  /** Client used to provision a wallet immediately after authentication. */
  walletProvisioningClient?: DaimoClient;
  /**
   * Announce the logged-in embedded wallet via EIP-6963 while true, so a
   * DaimoModal on the same page can offer it as a connected wallet. Used by
   * the account page's repeat-deposit flow; leave unset everywhere else —
   * the wallet becomes visible to every EIP-6963 consumer on the page.
   */
  announceEmbeddedWallet?: boolean;
  children: ReactNode;
};

export function AccountFlowProvider({
  privyAppId,
  walletProvisioningClient,
  announceEmbeddedWallet = false,
  children,
}: AccountFlowProviderProps) {
  const accountFlow = useAccountFlowState();

  return (
    <AccountFlowContext.Provider value={accountFlow}>
      <PrivyProvider
        appId={privyAppId}
        config={{
          embeddedWallets: {
            ethereum: { createOnLogin: "off" },
            showWalletUIs: false,
          },
        }}
      >
        <PrivyConsumer
          accountFlow={accountFlow}
          announceEmbeddedWallet={announceEmbeddedWallet}
          walletProvisioningClient={walletProvisioningClient}
        />
        {children}
      </PrivyProvider>
    </AccountFlowContext.Provider>
  );
}

function PrivyConsumer({
  accountFlow,
  announceEmbeddedWallet,
  walletProvisioningClient,
}: {
  accountFlow: ReturnType<typeof useAccountFlowState>;
  announceEmbeddedWallet: boolean;
  walletProvisioningClient?: DaimoClient;
}) {
  const { ready, authenticated, logout, getAccessToken, user } = usePrivy();
  const { refreshUser } = useUser();
  const { sendCode: rawSendCode, loginWithCode: rawLoginWithCode } =
    useLoginWithEmail();
  const { sendTransaction: rawSendTransaction } = useSendTransaction();
  const { addSigners: rawAddSigners } = useSigners();
  const { wallets } = useWallets();

  const sendCode = useCallback(
    async (email: string) => {
      await rawSendCode({ email });
    },
    [rawSendCode],
  );

  const loginWithCode = useCallback(
    async (code: string) => {
      await rawLoginWithCode({ code });
    },
    [rawLoginWithCode],
  );

  const walletAddress = getCanonicalPrivyWalletAddress({
    userWalletAddress: user?.wallet?.address,
    linkedAccounts: user?.linkedAccounts ?? [],
    connectedWallets: wallets,
  });
  const embeddedWallets = useMemo(
    () => listPrivyEmbeddedWallets(user?.linkedAccounts ?? []),
    [user?.linkedAccounts],
  );
  const refreshEmbeddedWallets = useCallback(async () => {
    const refreshedUser = await refreshUser();
    return listPrivyEmbeddedWallets(refreshedUser.linkedAccounts ?? []);
  }, [refreshUser]);
  const email = user?.email?.address ?? null;
  const phoneNumber = user?.phone?.number ?? null;
  const signingWallet = findCanonicalPrivyWallet(wallets, walletAddress);

  const addSigners = useCallback(
    async (args: {
      walletAddress: `0x${string}`;
      quorumId: string;
      policyId: string;
    }) => {
      await rawAddSigners({
        address: args.walletAddress,
        signers: [
          {
            signerId: args.quorumId,
            policyIds: [args.policyId],
          },
        ],
      });
    },
    [rawAddSigners],
  );

  const signTypedData = useCallback(
    async (typedData: Record<string, unknown>): Promise<string> => {
      if (!signingWallet || !walletAddress) {
        throw new Error("no canonical embedded wallet");
      }
      const provider = await signingWallet.getEthereumProvider();
      const result = await provider.request({
        method: "eth_signTypedData_v4",
        params: [walletAddress, JSON.stringify(typedData)],
      });
      return result as string;
    },
    [signingWallet, walletAddress],
  );

  const sendSponsoredTransaction = useCallback(
    async (transaction: {
      chainId: number;
      to: `0x${string}`;
      data?: `0x${string}`;
      value?: bigint;
    }): Promise<`0x${string}`> => {
      if (!signingWallet || !walletAddress) {
        throw new Error("no canonical embedded wallet");
      }
      const { hash } = await rawSendTransaction(transaction, {
        address: walletAddress,
        sponsor: true,
      });
      return hash;
    },
    [rawSendTransaction, signingWallet, walletAddress],
  );

  const hooks = useMemo(
    () => ({
      sendCode,
      loginWithCode,
      refreshUser,
      refreshEmbeddedWallets,
      addSigners,
      getAccessToken,
      signTypedData,
      sendSponsoredTransaction,
      logout,
      ready,
      authenticated,
      email,
      walletAddress,
      embeddedWallets,
      phoneNumber,
    }),
    [
      ready,
      authenticated,
      email,
      walletAddress,
      phoneNumber,
      sendCode,
      loginWithCode,
      refreshUser,
      refreshEmbeddedWallets,
      addSigners,
      getAccessToken,
      signTypedData,
      sendSponsoredTransaction,
      logout,
      embeddedWallets,
    ],
  );

  useEffect(() => {
    accountFlow.registerPrivy(hooks);
  }, [hooks, accountFlow.registerPrivy]);

  useEffect(() => {
    if (
      !walletProvisioningClient ||
      !ready ||
      !authenticated ||
      walletAddress
    ) {
      return;
    }
    void accountFlow.ensureWallet(walletProvisioningClient).catch((err) => {
      accountFlow.setAuthError(
        err instanceof Error ? err.message : "failed to prepare wallet",
      );
    });
  }, [
    accountFlow.ensureWallet,
    accountFlow.setAuthError,
    authenticated,
    ready,
    walletAddress,
    walletProvisioningClient,
  ]);

  // EIP-6963 announce: respond to requestProvider and announce once resolved,
  // for as long as the flag is on. Consumers (DaimoModal's useInjectedWallets)
  // keep listening after mount, so a late announce still connects.
  useEffect(() => {
    if (!announceEmbeddedWallet || !signingWallet) return;

    let cancelled = false;
    let provider: Awaited<
      ReturnType<typeof signingWallet.getEthereumProvider>
    > | null = null;
    const announce = () => {
      if (!provider) return;
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: Object.freeze({ info: EMBEDDED_WALLET_INFO, provider }),
        }),
      );
    };

    void signingWallet.getEthereumProvider().then((result) => {
      if (cancelled) return;
      provider = result;
      announce();
    });
    window.addEventListener("eip6963:requestProvider", announce);
    return () => {
      cancelled = true;
      window.removeEventListener("eip6963:requestProvider", announce);
    };
  }, [announceEmbeddedWallet, signingWallet]);

  return null;
}
