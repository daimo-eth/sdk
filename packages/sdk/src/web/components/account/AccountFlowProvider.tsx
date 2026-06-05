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
  useWallets,
} from "@privy-io/react-auth";
import { type ReactNode, useCallback, useEffect, useMemo } from "react";

import {
  AccountFlowContext,
  useAccountFlowState,
} from "../../hooks/useAccountFlow.js";
import {
  findCanonicalPrivyWallet,
  getCanonicalPrivyWalletAddress,
  hasPrivyEmbeddedWallet,
} from "../../accountWallet.js";

type AccountFlowProviderProps = {
  privyAppId: string;
  children: ReactNode;
};

export function AccountFlowProvider({
  privyAppId,
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
        <PrivyConsumer accountFlow={accountFlow} />
        {children}
      </PrivyProvider>
    </AccountFlowContext.Provider>
  );
}

function PrivyConsumer({
  accountFlow,
}: {
  accountFlow: ReturnType<typeof useAccountFlowState>;
}) {
  const { ready, authenticated, logout, getAccessToken, createWallet, user } =
    usePrivy();
  const { sendCode: rawSendCode, loginWithCode: rawLoginWithCode } =
    useLoginWithEmail();
  const { wallets, ready: walletsReady } = useWallets();

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
  const email = user?.email?.address ?? null;
  const phoneNumber = user?.phone?.number ?? null;
  const hasEmbeddedWallet = hasPrivyEmbeddedWallet([
    ...(user?.linkedAccounts ?? []),
    ...wallets,
  ]);
  const signingWallet = findCanonicalPrivyWallet(wallets, walletAddress);

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

  const hooks = useMemo(
    () => ({
      sendCode,
      loginWithCode,
      createWallet,
      getAccessToken,
      signTypedData,
      logout,
      ready,
      authenticated,
      email,
      walletAddress,
      walletsReady,
      hasEmbeddedWallet,
      phoneNumber,
    }),
    [
      ready,
      authenticated,
      email,
      walletAddress,
      walletsReady,
      hasEmbeddedWallet,
      phoneNumber,
      sendCode,
      loginWithCode,
      createWallet,
      getAccessToken,
      signTypedData,
      logout,
    ],
  );

  useEffect(() => {
    accountFlow.registerPrivy(hooks);
  }, [hooks, accountFlow.registerPrivy]);

  return null;
}
