import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { getAddress } from "viem";

import type {
  AccountEnrollmentUpdate,
  AccountRail,
  CreateAccountResponse,
  DepositPaymentInfo,
  EnsureAccountWalletResponse,
  GetAccountResponse,
  PrivySignerConfig,
  PrivyWalletIdentity,
} from "../../common/account.js";
import type { DaimoClient } from "../../client/createDaimoClient.js";
import {
  authorizePrivyWallet,
  type PrivySignerEnrollmentClientState,
} from "../privySignerEnrollment.js";
import { findPrivyEmbeddedWalletByAddress } from "../accountWallet.js";

const ACCOUNT_FLOW_READY_POLL_MS = 50;
const ACCOUNT_FLOW_READY_TIMEOUT_MS = 15_000;

/** Auth-provider hooks registered by AccountFlowProvider. */
export type PrivyHooks = {
  sendCode: (email: string) => Promise<void>;
  loginWithCode: (code: string) => Promise<void>;
  refreshUser: () => Promise<unknown>;
  refreshEmbeddedWallets?: () => Promise<readonly PrivyWalletIdentity[]>;
  addSigners?: (args: {
    walletAddress: PrivyWalletIdentity["walletAddress"];
    quorumId: string;
    policyId: string;
  }) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  signTypedData: (typedData: Record<string, unknown>) => Promise<string>;
  sendSponsoredTransaction: (transaction: {
    chainId: number;
    to: `0x${string}`;
    data?: `0x${string}`;
    value?: bigint;
  }) => Promise<`0x${string}`>;
  logout: () => Promise<void>;
  ready: boolean;
  authenticated: boolean;
  email: string | null;
  walletAddress: string | null;
  embeddedWallets?: readonly PrivyWalletIdentity[];
  phoneNumber: string | null;
};

/**
 * Per-session deposit state. Identity is `sessionId`, current user intent is
 * `depositAmount`. `kind` tracks preview vs started provider flow.
 */
export type DepositStateInput =
  | { depositAmount: string; kind: "idle" }
  | { depositAmount: string; kind: "drafting" }
  | {
      depositAmount: string;
      kind: "drafted";
      depositId: string;
      payment: DepositPaymentInfo;
      enrollmentUpdate?: never;
    }
  | {
      depositAmount: string;
      kind: "drafted";
      depositId: string;
      payment: null;
      enrollmentUpdate: AccountEnrollmentUpdate;
    }
  | {
      depositAmount: string;
      kind: "started";
      depositId: string;
      payment: DepositPaymentInfo;
      selectedInstitutionId?: string;
    };

export type DepositState = DepositStateInput & { sessionId: string };
type SessionContext = { sessionId: string; clientSecret: string };

export type AccountFlowState = {
  email: string;
  setEmail: (email: string) => void;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;

  isLoggingIn: boolean;
  /** Whether the auth provider has finished restoring the session from storage. */
  isReady: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  setAuthError: (error: string | null) => void;

  sendOtp: (email?: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<boolean>;

  /** Send a Daimo-owned phone OTP for an enrollment interaction. */
  sendPhoneOtp: (
    phoneNumber: string | undefined,
    client: DaimoClient,
  ) => Promise<boolean>;
  /** Verify a Daimo-owned phone OTP code for an enrollment interaction. */
  verifyPhoneOtp: (code: string, client: DaimoClient) => Promise<boolean>;
  isCreatingWallet: boolean;
  walletAddress: string | null;
  embeddedWallets: readonly PrivyWalletIdentity[];
  /** Ensure a wallet and return its address. */
  ensureWallet: (client: DaimoClient) => Promise<string>;
  /** Ensure a wallet and return signer-aware server details when available. */
  ensureWalletDetails: (
    client: DaimoClient,
  ) => Promise<EnsureAccountWalletResponse>;
  resolveEmbeddedWallet: (
    walletAddress: string,
  ) => Promise<PrivyWalletIdentity | null>;
  authorizeWalletSigner: (
    client: DaimoClient,
    wallet: PrivyWalletIdentity,
    signerConfig: PrivySignerConfig,
  ) => Promise<PrivySignerEnrollmentClientState>;

  getAccessToken: () => Promise<string | null>;
  signTypedData: (typedData: Record<string, unknown>) => Promise<string>;
  sendSponsoredTransaction: PrivyHooks["sendSponsoredTransaction"];

  getDepositState: (sessionId: string) => DepositState | null;
  setDepositState: (sessionId: string, state: DepositStateInput) => void;
  clearDepositState: (sessionId: string) => void;

  createAccount: (
    client: DaimoClient,
    session: SessionContext,
    walletAddress: string,
  ) => Promise<void>;
  createAccountResult: (
    client: DaimoClient,
    session: SessionContext,
    walletAddress: string,
  ) => Promise<CreateAccountResponse>;
  getAccount: (
    client: DaimoClient,
    session: SessionContext,
    target: { rail: AccountRail },
  ) => Promise<GetAccountResponse | null>;
  logout: () => Promise<void>;

  /** Wait for auth state to finish restoring. Resolves immediately if ready. */
  waitForReady: () => Promise<void>;

  /** Register auth-provider hooks (called by AccountFlowProvider). */
  registerPrivy: (hooks: PrivyHooks) => void;
};

// Context (not a plain hook like useWalletFlow) because the auth provider must
// wrap the components that use these hooks. The account flow state lives above
// the provider so the consumer can bridge auth hooks into it.
// Limitation: one AccountFlowProvider per page = one shared auth session.
export const AccountFlowContext = createContext<AccountFlowState | null>(null);

export function useAccountFlow(): AccountFlowState | null {
  return useContext(AccountFlowContext);
}

export function useSessionDepositState(sessionId: string) {
  const accountFlow = useAccountFlow();
  const depositState = accountFlow?.getDepositState(sessionId) ?? null;

  const setDepositState = useCallback(
    (state: DepositStateInput) => {
      accountFlow?.setDepositState(sessionId, state);
    },
    [accountFlow, sessionId],
  );

  const clearDepositState = useCallback(() => {
    accountFlow?.clearDepositState(sessionId);
  }, [accountFlow, sessionId]);

  return { accountFlow, depositState, setDepositState, clearDepositState };
}

/** Create the account flow state object. Used by the AccountFlowProvider. */
export function useAccountFlowState(): AccountFlowState {
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [embeddedWallets, setEmbeddedWallets] = useState<
    readonly PrivyWalletIdentity[]
  >([]);
  const [storedDepositState, setStoredDepositState] =
    useState<DepositState | null>(null);

  const privyRef = useRef<PrivyHooks | null>(null);
  const ensureWalletRef = useRef<Promise<EnsureAccountWalletResponse> | null>(
    null,
  );

  // PrivyConsumer calls registerPrivy on every Privy state change,
  // keeping our state in sync without polling.
  const registerPrivy = useCallback((hooks: PrivyHooks) => {
    privyRef.current = hooks;
    setIsReady(hooks.ready);
    setIsAuthenticated(hooks.authenticated);
    setWalletAddress(hooks.walletAddress);
    setEmbeddedWallets(hooks.embeddedWallets ?? []);
    const email = hooks.email;
    if (email) {
      setEmail((current) => (current === email ? current : email));
    }
    if (hooks.phoneNumber) {
      setPhoneNumber((current) =>
        current === hooks.phoneNumber
          ? current
          : (hooks.phoneNumber ?? current),
      );
    }
  }, []);

  const waitForReady = useCallback((): Promise<void> => {
    return waitForAccountFlowState(
      () => privyRef.current?.ready === true,
      "authentication initialization timed out",
    );
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return privyRef.current?.getAccessToken() ?? null;
  }, []);

  const sendOtp = useCallback(
    async (overrideEmail?: string): Promise<boolean> => {
      const target = overrideEmail ?? email;
      if (!privyRef.current) {
        setAuthError("privy not initialized");
        return false;
      }
      if (!target) {
        setAuthError("email is required");
        return false;
      }
      setIsLoggingIn(true);
      setAuthError(null);
      try {
        await waitForReady();
        await privyRef.current.sendCode(target);
        return true;
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : "failed to send code",
        );
        return false;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [email, waitForReady],
  );

  const verifyOtp = useCallback(
    async (code: string): Promise<boolean> => {
      if (!privyRef.current) return false;
      setIsLoggingIn(true);
      setAuthError(null);
      try {
        await waitForReady();
        await privyRef.current.loginWithCode(code);
        setIsAuthenticated(true);
        return true;
      } catch (err) {
        setAuthError(privyAuthErrorMessage(err));
        return false;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [waitForReady],
  );

  const sendPhoneOtp = useCallback(
    async (
      overridePhone: string | undefined,
      client: DaimoClient,
    ): Promise<boolean> => {
      const target = overridePhone ?? phoneNumber;
      if (!privyRef.current) {
        setAuthError("privy not initialized");
        return false;
      }
      if (!target) {
        setAuthError("phone number is required");
        return false;
      }
      setIsLoggingIn(true);
      setAuthError(null);
      try {
        await waitForReady();
        const token = await getAccessToken();
        if (!token) throw new Error("not authenticated");
        await client.account.sendPhoneOtp(
          { phoneNumber: target },
          { bearerToken: token },
        );
        return true;
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : "failed to send code",
        );
        return false;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [getAccessToken, phoneNumber, waitForReady],
  );

  const verifyPhoneOtp = useCallback(
    async (code: string, client: DaimoClient): Promise<boolean> => {
      if (!privyRef.current) return false;
      setIsLoggingIn(true);
      setAuthError(null);
      try {
        await waitForReady();
        if (!phoneNumber) throw new Error("phone number is required");
        const token = await getAccessToken();
        if (!token) throw new Error("not authenticated");
        await client.account.verifyPhoneOtp(
          { phoneNumber, code },
          { bearerToken: token },
        );
        return true;
      } catch (err) {
        setAuthError(privyAuthErrorMessage(err));
        return false;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [getAccessToken, phoneNumber, waitForReady],
  );

  const ensureWalletDetails = useCallback(
    (client: DaimoClient): Promise<EnsureAccountWalletResponse> => {
      if (ensureWalletRef.current) return ensureWalletRef.current;

      const run = async (): Promise<EnsureAccountWalletResponse> => {
        if (!privyRef.current) throw new Error("privy not initialized");
        setIsCreatingWallet(true);
        await waitForReady();
        const token = await privyRef.current.getAccessToken();
        if (!token) throw new Error("not authenticated");

        const wallet = await client.account.ensureWallet({
          bearerToken: token,
        });
        await privyRef.current.refreshUser();
        await waitForAccountFlowState(
          () =>
            accountWalletAddressesMatch(
              privyRef.current?.walletAddress ?? null,
              wallet.walletAddress,
            ),
          "wallet synchronization timed out",
        );
        setWalletAddress(wallet.walletAddress);
        return wallet;
      };

      ensureWalletRef.current = run().finally(() => {
        setIsCreatingWallet(false);
        ensureWalletRef.current = null;
      });

      return ensureWalletRef.current;
    },
    [waitForReady],
  );

  const ensureWallet = useCallback(
    async (client: DaimoClient): Promise<string> => {
      const wallet = await ensureWalletDetails(client);
      return wallet.walletAddress;
    },
    [ensureWalletDetails],
  );

  const resolveEmbeddedWallet = useCallback(
    async (accountWalletAddress: string) => {
      const current = findPrivyEmbeddedWalletByAddress(
        privyRef.current?.embeddedWallets ?? [],
        accountWalletAddress,
      );
      if (current) return current;

      const refreshed = await privyRef.current?.refreshEmbeddedWallets?.();
      return findPrivyEmbeddedWalletByAddress(
        refreshed ?? [],
        accountWalletAddress,
      );
    },
    [],
  );

  const confirmSignerEnrollment = useCallback(
    async (client: DaimoClient, walletId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error("not authenticated");
      const { enrollment } = await client.account.confirmPrivySignerEnrollment(
        { walletId },
        { bearerToken: token },
      );
      return enrollment;
    },
    [getAccessToken],
  );

  const authorizeWalletSigner = useCallback(
    async (
      client: DaimoClient,
      wallet: PrivyWalletIdentity,
      signerConfig: PrivySignerConfig,
    ): Promise<PrivySignerEnrollmentClientState> => {
      return authorizePrivyWallet({
        wallet,
        config: signerConfig,
        confirm: (walletId) => confirmSignerEnrollment(client, walletId),
        addSigners: (args) => {
          if (!privyRef.current) throw new Error("privy not initialized");
          if (!privyRef.current.addSigners) {
            throw new Error("privy signer authorization unavailable");
          }
          return privyRef.current.addSigners(args);
        },
      });
    },
    [confirmSignerEnrollment],
  );

  const signTypedData = useCallback(
    async (typedData: Record<string, unknown>): Promise<string> => {
      if (!privyRef.current) throw new Error("privy not initialized");
      return privyRef.current.signTypedData(typedData);
    },
    [],
  );

  const sendSponsoredTransaction = useCallback(
    async (
      transaction: Parameters<PrivyHooks["sendSponsoredTransaction"]>[0],
    ): Promise<`0x${string}`> => {
      if (!privyRef.current) throw new Error("privy not initialized");
      return privyRef.current.sendSponsoredTransaction(transaction);
    },
    [],
  );

  const getDepositState = useCallback(
    (sessionId: string): DepositState | null => {
      if (storedDepositState?.sessionId !== sessionId) return null;
      return storedDepositState;
    },
    [storedDepositState],
  );

  const setDepositState = useCallback(
    (sessionId: string, state: DepositStateInput) => {
      setStoredDepositState({ sessionId, ...state });
    },
    [],
  );

  const clearDepositState = useCallback((sessionId: string) => {
    setStoredDepositState((current) =>
      current?.sessionId === sessionId ? null : current,
    );
  }, []);

  const createAccountResult = useCallback(
    async (client: DaimoClient, session: SessionContext, addr: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error("not authenticated");
      return client.account.create({ walletAddress: addr }, session, {
        bearerToken: token,
      });
    },
    [getAccessToken],
  );

  const createAccount = useCallback(
    async (client: DaimoClient, session: SessionContext, addr: string) => {
      await createAccountResult(client, session, addr);
    },
    [createAccountResult],
  );

  const getAccount = useCallback(
    async (
      client: DaimoClient,
      session: SessionContext,
      target: { rail: AccountRail },
    ): Promise<GetAccountResponse | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      try {
        return await client.account.get(target, session, {
          bearerToken: token,
        });
      } catch {
        return null;
      }
    },
    [getAccessToken],
  );

  const logout = useCallback(async () => {
    try {
      await privyRef.current?.logout();
    } catch {
      // Ignore — no active session to destroy
    }
    setIsAuthenticated(false);
    setWalletAddress(null);
    setEmbeddedWallets([]);
    setEmail("");
    setPhoneNumber("");
    setAuthError(null);
    setStoredDepositState(null);
  }, []);

  return {
    email,
    setEmail,
    phoneNumber,
    setPhoneNumber,
    isLoggingIn,
    isReady,
    isAuthenticated,
    authError,
    setAuthError,
    sendOtp,
    verifyOtp,
    sendPhoneOtp,
    verifyPhoneOtp,
    isCreatingWallet,
    walletAddress,
    embeddedWallets,
    ensureWallet,
    ensureWalletDetails,
    resolveEmbeddedWallet,
    authorizeWalletSigner,
    getAccessToken,
    signTypedData,
    sendSponsoredTransaction,
    getDepositState,
    setDepositState,
    clearDepositState,
    createAccount,
    createAccountResult,
    getAccount,
    logout,
    waitForReady,
    registerPrivy,
  };
}

function privyAuthErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "failed to verify code";
}

export function accountWalletAddressesMatch(
  currentAddress: string | null,
  ensuredAddress: string,
): boolean {
  return (
    currentAddress != null &&
    getAddress(currentAddress) === getAddress(ensuredAddress)
  );
}

/** Wait for auth-provider state without allowing a broken client to hang forever. */
export function waitForAccountFlowState(
  isReady: () => boolean,
  timeoutMessage: string,
  timeoutMs = ACCOUNT_FLOW_READY_TIMEOUT_MS,
): Promise<void> {
  if (isReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (isReady()) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(timeoutMessage));
        return;
      }
      setTimeout(check, Math.min(ACCOUNT_FLOW_READY_POLL_MS, timeoutMs));
    };
    check();
  });
}
