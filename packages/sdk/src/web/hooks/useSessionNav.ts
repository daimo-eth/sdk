import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AccountRail } from "../../common/account.js";
import type { AccountAuthConfig } from "../api/index.js";
import type {
  NavNode,
  NavNodeCashApp,
  NavNodeChooseOption,
  NavNodeExchange,
  NavNodeFiat,
  NavNodeStripe,
  NavNodeTronDeposit,
  SessionWithNav,
} from "../api/navTree.js";
import type { WalletPaymentOption } from "../api/walletTypes.js";

import { getAccountPaymentEntryTarget } from "../components/account/accountNav.js";
import { detectPlatform, isDesktop, type DaimoPlatform } from "../platform.js";
import { isFramed, railRequiresPopup } from "../components/account/fiatPopup.js";
import { pruneCompletedAccountAuth } from "./accountAuthNav.js";
import { useDaimoClient } from "./DaimoClientContext.js";
import { formatUserError } from "./formatUserError.js";
import { t } from "./locale.js";
import { createNavLogger, type NavNodeType } from "./navEvent.js";
import { findNode, type AccountNavEntry, type NavEntry } from "./types.js";
import type { AccountFlowState } from "./useAccountFlow.js";
import type { InjectedWallet } from "./useInjectedWallets.js";
import { isUserRejection, type WalletFlowResult } from "./useWalletFlow.js";

type NodeContext = { nodeId: string | null; nodeType: NavNodeType | null };
type ExchangeId =
  | "Coinbase"
  | "Binance"
  | "Lemon"
  | "BitgetExchange"
  | "BybitExchange"
  | "MtPelerin"
  | "CashApp";
type ExchangeNode = NavNodeExchange | NavNodeCashApp;

type SessionNavResult = {
  stack: NavEntry[];
  topEntry: NavEntry | null;
  getNodeCtx: () => NodeContext;
  canGoBack: boolean;

  handleNavigate: (nodeId: string, options?: { autoNav?: boolean }) => void;
  handleBack: () => void;
  handleAmountContinue: (amountUsd: number) => void;
  handleRetry: () => void;
  handleRefresh: () => Promise<void>;

  handleInjectedWalletSelect: (wallet: InjectedWallet) => void;
  handleChainSelect: (chain: "evm" | "solana") => void;
  handleWalletSelectToken: (token: WalletPaymentOption) => void;
  handleWalletSending: (token: WalletPaymentOption, amountUsd: number) => void;

  handleShowMobileWallets: (nodeId: string) => void;

  /** Advance account flow to the next screen. */
  handleAccountAdvance: (nextType: AccountNavEntry["type"]) => void;
  /** Reset the current account rail after logout. */
  handleAccountLogout: () => void;
};

function isExchangeNode(node: NavNode | null): node is ExchangeNode {
  return node?.type === "Exchange" || node?.type === "CashApp";
}

function isStripeNode(node: NavNode | null): node is NavNodeStripe {
  return node?.type === "Stripe";
}

function isTrustTronNode(node: NavNode | null): node is NavNodeTronDeposit {
  return node?.type === "TronDeposit" && node.id === "Trust-Tron";
}

function getExchangeSelection(node: ExchangeNode): {
  exchangeId: ExchangeId;
  nodeType: "Exchange" | "CashApp";
} {
  if (node.type === "CashApp") {
    return { exchangeId: "CashApp", nodeType: "CashApp" };
  }
  return { exchangeId: node.exchangeId, nodeType: "Exchange" };
}

function replacePendingAccountEntry(
  stack: NavEntry[],
  nodeId: string,
  rail: AccountRail,
  entry: NavEntry,
) {
  for (let index = stack.length - 1; index >= 0; index--) {
    const item = stack[index];
    if (
      item.type === "account-loading" &&
      item.nodeId === nodeId &&
      item.rail === rail
    ) {
      return [...stack.slice(0, index), entry, ...stack.slice(index + 1)];
    }
  }
  return stack;
}

function isSameAccountRailEntry(
  entry: NavEntry,
  nodeId: string,
  rail: AccountRail,
) {
  return "rail" in entry && entry.nodeId === nodeId && entry.rail === rail;
}

function accountEntry(entry: NavEntry | null): AccountNavEntry {
  if (entry == null || !("rail" in entry)) {
    throw new Error("account nav entry required");
  }
  return entry;
}

export function useSessionNav(
  session: SessionWithNav,
  setSession: React.Dispatch<React.SetStateAction<SessionWithNav>>,
  isOpen: boolean,
  accountAuth: AccountAuthConfig | null,
  platform?: DaimoPlatform,
  walletFlow?: WalletFlowResult,
  accountFlow?: AccountFlowState | null,
  options?: {
    /** Pop out popup-required fiat rails when framed. */
    enableFiatPopup?: boolean;
    /** Node to auto-navigate to on load (popup deep-link). */
    startNodeId?: string;
  },
): SessionNavResult {
  const enableFiatPopup = options?.enableFiatPopup ?? false;
  const startNodeId = options?.startNodeId;
  const effectivePlatform = platform ?? detectPlatform();
  const client = useDaimoClient();
  const logNavEvent = createNavLogger(client);

  const [stack, setStack] = useState<NavEntry[]>([]);

  const topEntry = stack.length > 0 ? stack[stack.length - 1] : null;

  const getNodeCtx = useCallback((): NodeContext => {
    const nodeId = topEntry?.nodeId ?? session.navTree[0]?.id ?? null;
    const nodeType = nodeId
      ? (findNode(nodeId, session.navTree)?.type ?? null)
      : null;
    return { nodeId, nodeType };
  }, [topEntry, session.navTree]);

  const canGoBack = stack.length > 0 && stack.some((e) => !e.autoNav);

  // ─── Async fetchers ─────────────────────────────────────────────────────

  const fetchTronAddress = useCallback(
    async (nodeId: string, amountUsd: number) => {
      try {
        const result = await client.sessions.paymentMethods.create(
          session.sessionId,
          {
            clientSecret: session.clientSecret,
            paymentMethod: { type: "tron", amountUsd },
          },
        );

        if (!result.tron) {
          throw new Error("tron address not returned");
        }
        const node = findNode(nodeId, session.navTree);
        const trustWalletDeeplink = isTrustTronNode(node)
          ? result.tron.deeplinks?.trustWallet
          : undefined;
        if (isTrustTronNode(node) && !trustWalletDeeplink) {
          throw new Error("trust wallet deeplink not returned");
        }

        logNavEvent(session.sessionId, session.clientSecret, {
          nodeId,
          nodeType: "TronDeposit",
          action: "flow_tron_address",
          success: true,
          address: result.tron.receiverAddress,
        });
        if (trustWalletDeeplink && !isDesktop(effectivePlatform)) {
          window.open(trustWalletDeeplink.url, "_blank");
        }
        setStack((prev) => {
          const top = prev[prev.length - 1];
          if (top?.type !== "waiting-tron" || top.nodeId !== nodeId)
            return prev;
          return [
            ...prev.slice(0, -1),
            {
              ...top,
              address: result.tron!.receiverAddress,
              expiresAt: result.tron!.expiresAt,
              trustWalletDeeplink,
              error: undefined,
            },
          ];
        });
      } catch (error) {
        console.error("failed to create tron address:", error);
        const errorMsg =
          error instanceof Error ? error.message : t.tronUnavailable;
        logNavEvent(session.sessionId, session.clientSecret, {
          nodeId,
          nodeType: "TronDeposit",
          action: "flow_tron_address",
          success: false,
          error: errorMsg,
        });
        setStack((prev) => {
          const top = prev[prev.length - 1];
          if (top?.type !== "waiting-tron" || top.nodeId !== nodeId)
            return prev;
          return [...prev.slice(0, -1), { ...top, error: errorMsg }];
        });
      }
    },
    [
      session.sessionId,
      session.clientSecret,
      session.navTree,
      effectivePlatform,
      client,
    ],
  );

  const fetchExchangeUrl = useCallback(
    async (
      nodeId: string,
      exchangeId: ExchangeId,
      amountUsd: number,
      nodeType: "Exchange" | "CashApp",
    ) => {
      try {
        const result = await client.sessions.paymentMethods.create(
          session.sessionId,
          {
            clientSecret: session.clientSecret,
            paymentMethod: {
              type: "exchange",
              exchangeId,
              amountUsd,
              platform: effectivePlatform,
            },
          },
        );
        if (!result.exchange) return;
        logNavEvent(session.sessionId, session.clientSecret, {
          nodeId,
          nodeType,
          action: "flow_exchange_url",
          exchangeId,
          success: true,
          url: result.exchange.url,
        });
        setStack((prev) => {
          const top = prev[prev.length - 1];
          if (top?.type !== "exchange-page" || top.nodeId !== nodeId)
            return prev;
          return [
            ...prev.slice(0, -1),
            {
              ...top,
              exchangeUrl: result.exchange!.url,
              waitingMessage: result.exchange!.waitingMessage,
              expiresAt: result.exchange!.expiresAt,
              error: undefined,
            },
          ];
        });
      } catch (error) {
        console.error("failed to get exchange url:", error);
        const errorMsg =
          error instanceof Error ? error.message : "failed to get exchange url";
        logNavEvent(session.sessionId, session.clientSecret, {
          nodeId,
          nodeType,
          action: "flow_exchange_url",
          exchangeId,
          success: false,
          error: errorMsg,
        });
        setStack((prev) => {
          const top = prev[prev.length - 1];
          if (top?.type !== "exchange-page" || top.nodeId !== nodeId)
            return prev;
          return [...prev.slice(0, -1), { ...top, error: errorMsg }];
        });
      }
    },
    [session.sessionId, session.clientSecret, effectivePlatform, client],
  );

  const fetchStripeOnramp = useCallback(
    async (nodeId: string, amountUsd: number) => {
      try {
        const result = await client.sessions.paymentMethods.create(
          session.sessionId,
          {
            clientSecret: session.clientSecret,
            paymentMethod: { type: "stripe", amountUsd },
          },
        );
        if (!result.stripe) {
          throw new Error("stripe onramp session not returned");
        }
        if (!result.stripe.redirectUrl) {
          throw new Error("stripe onramp url not returned");
        }

        logNavEvent(session.sessionId, session.clientSecret, {
          nodeId,
          nodeType: "Stripe",
          action: "flow_stripe_onramp",
          success: true,
        });
        setStack((prev) => {
          const top = prev[prev.length - 1];
          if (top?.type !== "stripe-onramp" || top.nodeId !== nodeId)
            return prev;
          return [
            ...prev.slice(0, -1),
            {
              ...top,
              onrampSessionClientSecret:
                result.stripe!.onrampSessionClientSecret,
              publishableKey: result.stripe!.publishableKey,
              redirectUrl: result.stripe!.redirectUrl,
              error: undefined,
            },
          ];
        });
      } catch (error) {
        console.error("failed to create stripe onramp:", error);
        const errorMsg =
          error instanceof Error
            ? error.message
            : "failed to create stripe onramp";
        logNavEvent(session.sessionId, session.clientSecret, {
          nodeId,
          nodeType: "Stripe",
          action: "flow_stripe_onramp",
          success: false,
          error: errorMsg,
        });
        setStack((prev) => {
          const top = prev[prev.length - 1];
          if (top?.type !== "stripe-onramp" || top.nodeId !== nodeId)
            return prev;
          return [...prev.slice(0, -1), { ...top, error: errorMsg }];
        });
      }
    },
    [session.sessionId, session.clientSecret, client],
  );

  // ─── Account deposit handler ────────────────────────────────────────────────

  const handleAccountNavigate = useCallback(
    async (nodeId: string, node: NavNodeFiat, autoNav: boolean) => {
      const rail = node.fiatMethod;
      setStack((prev) => [
        ...prev,
        { type: "account-loading", nodeId, rail, autoNav },
      ]);

      const replaceLoading = (entry: NavEntry) => {
        setStack((prev) =>
          replacePendingAccountEntry(prev, nodeId, rail, entry),
        );
      };

      if (!accountFlow) {
        replaceLoading({
          type: "account-error",
          nodeId,
          rail,
          autoNav,
          message: "account deposit is not available for this session.",
        });
        return;
      }

      // Wait for Privy to finish restoring session from storage before
      // deciding whether to show login. Without this, auto-nav fires
      // before Privy is ready and always shows the email screen.
      await accountFlow.waitForReady();

      // Re-check auth after ready — getAccessToken reads from the ref
      // which always has the latest Privy state.
      const token = await accountFlow.getAccessToken();

      // If user has an active Privy session, check their account status
      // to skip onboarding steps they've already completed.
      if (token) {
        const sessionCtx = {
          sessionId: session.sessionId,
          clientSecret: session.clientSecret,
        };
        const result = await accountFlow.getAccount(client, sessionCtx, {
          rail,
        });
        if (result) {
          if (result.nextAction === "ready_for_payment") {
            // Some rails skip the amount-first step and go straight to a
            // unified payment page.
            const entryType = getAccountPaymentEntryTarget(rail);
            replaceLoading({ type: entryType, nodeId, rail, autoNav });
            return;
          }
          if (result.nextAction === "enrollment") {
            replaceLoading({
              type: "account-enrollment",
              nodeId,
              rail,
              autoNav,
            });
            return;
          }
          if (result.nextAction === "enrollment_update") {
            replaceLoading({
              type: "account-enrollment-update",
              nodeId,
              rail,
              autoNav,
              update: result.enrollmentUpdate,
            });
            return;
          }
        }
      }

      if (accountAuth?.email) {
        await accountFlow.logout();
        accountFlow.setEmail(accountAuth.email);
        const sent = await accountFlow.sendOtp(accountAuth.email);
        if (sent) {
          replaceLoading({ type: "account-otp", nodeId, rail, autoNav });
          return;
        }
      }

      // New user or no email hint — start from email
      replaceLoading({ type: "account-email", nodeId, rail, autoNav });
    },
    [accountAuth, accountFlow, client, session.clientSecret, session.sessionId],
  );

  // ─── Navigation handlers ────────────────────────────────────────────────

  const handleNavigate = useCallback(
    (nodeId: string, options?: { autoNav?: boolean }) => {
      const nodeCtx = getNodeCtx();
      const targetNode = findNode(nodeId, session.navTree);
      if (!targetNode || targetNode.disabledReason) return;

      const autoNav = options?.autoNav ?? false;

      if (targetNode.type === "Deeplink" && targetNode.url) {
        logNavEvent(session.sessionId, session.clientSecret, {
          ...nodeCtx,
          action: "nav_deeplink",
          url: targetNode.url,
        });
        if (!isDesktop(effectivePlatform)) {
          window.open(targetNode.url, "_blank");
        }
      }

      logNavEvent(session.sessionId, session.clientSecret, {
        ...nodeCtx,
        action: "nav_select",
        targetNodeId: nodeId,
        targetNodeType: targetNode.type,
      });

      if (targetNode.type === "ChooseOption") {
        setStack((prev) => [
          ...prev,
          { type: "choose-option", nodeId, autoNav },
        ]);
        return;
      }

      if (targetNode.type === "Deeplink") {
        setStack((prev) => [...prev, { type: "deeplink", nodeId, autoNav }]);
        return;
      }

      if (targetNode.type === "ConnectedWallet") {
        setStack((prev) => [
          ...prev,
          { type: "wallet-select-token", nodeId, autoNav },
        ]);
        return;
      }

      if (targetNode.type === "DepositAddress") {
        const requiredUsd = targetNode.requiredUsd ?? 0;
        if (requiredUsd > 0) {
          setStack((prev) => [
            ...prev,
            {
              type: "waiting-deposit",
              nodeId,
              amountUsd: requiredUsd,
              autoNav,
            },
          ]);
          return;
        }
        setStack((prev) => [
          ...prev,
          { type: "select-amount", nodeId, flowType: "deposit", autoNav },
        ]);
        return;
      }

      if (targetNode.type === "TronDeposit") {
        const requiredUsd = targetNode.requiredUsd ?? 0;
        if (requiredUsd > 0) {
          setStack((prev) => [
            ...prev,
            {
              type: "waiting-tron",
              nodeId,
              amountUsd: requiredUsd,
              autoNav,
            },
          ]);
          fetchTronAddress(nodeId, requiredUsd);
          return;
        }
        setStack((prev) => [
          ...prev,
          { type: "select-amount", nodeId, flowType: "tron", autoNav },
        ]);
        return;
      }

      if (isExchangeNode(targetNode)) {
        const { exchangeId, nodeType } = getExchangeSelection(targetNode);
        const requiredUsd = targetNode.requiredUsd ?? 0;
        if (requiredUsd > 0) {
          setStack((prev) => [
            ...prev,
            { type: "exchange-page", nodeId, amountUsd: requiredUsd, autoNav },
          ]);
          fetchExchangeUrl(nodeId, exchangeId, requiredUsd, nodeType);
          return;
        }
        setStack((prev) => [
          ...prev,
          {
            type: "select-amount",
            nodeId,
            flowType: targetNode.type === "CashApp" ? "cashapp" : "exchange",
            autoNav,
          },
        ]);
        return;
      }

      if (isStripeNode(targetNode)) {
        const requiredUsd = targetNode.requiredUsd ?? 0;
        if (requiredUsd > 0) {
          setStack((prev) => [
            ...prev,
            { type: "stripe-onramp", nodeId, amountUsd: requiredUsd, autoNav },
          ]);
          fetchStripeOnramp(nodeId, requiredUsd);
          return;
        }
        setStack((prev) => [
          ...prev,
          { type: "select-amount", nodeId, flowType: "stripe", autoNav },
        ]);
        return;
      }

      if (targetNode.type === "Fiat") {
        if (
          enableFiatPopup &&
          railRequiresPopup(targetNode.fiatMethod) &&
          isFramed()
        ) {
          setStack((prev) => [
            ...prev,
            {
              type: "fiat-popup",
              nodeId,
              rail: targetNode.fiatMethod,
              autoNav,
            },
          ]);
          return;
        }
        handleAccountNavigate(nodeId, targetNode, autoNav);
        return;
      }
    },
    [
      session.navTree,
      session.sessionId,
      getNodeCtx,
      fetchTronAddress,
      fetchExchangeUrl,
      fetchStripeOnramp,
      handleAccountNavigate,
      enableFiatPopup,
    ],
  );

  const handleBack = useCallback(() => {
    logNavEvent(session.sessionId, session.clientSecret, {
      ...getNodeCtx(),
      action: "nav_back",
    });

    setStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      while (next.length > 0) {
        const top = next[next.length - 1];
        // Skip auto-advancing account gates on back — these re-poll and
        // jump forward when revisited, creating a loop.
        if (
          top.type === "account-creating-wallet" ||
          top.type === "account-enrollment" ||
          top.type === "account-provider-otp" ||
          top.type === "account-enrollment-update"
        ) {
          next.pop();
          continue;
        }
        if (!top.autoNav) break;
        if (top.type === "select-amount") break;
        if (top.type === "wallet-select-token") break;
        if (top.type === "choose-option") {
          const node = findNode(
            top.nodeId,
            session.navTree,
          ) as NavNodeChooseOption | null;
          if (node != null && node.options.length > 1) break;
        }
        next.pop();
      }
      return next;
    });
  }, [session.sessionId, session.navTree, getNodeCtx]);

  // ─── Flow handlers ──────────────────────────────────────────────────────

  const handleAmountContinue = useCallback(
    (amountUsd: number) => {
      if (!topEntry || topEntry.type !== "select-amount") return;
      const { nodeId, flowType } = topEntry;

      logNavEvent(session.sessionId, session.clientSecret, {
        nodeId,
        nodeType:
          flowType === "deposit"
            ? "DepositAddress"
            : flowType === "tron"
              ? "TronDeposit"
              : flowType === "cashapp"
                ? "CashApp"
                : flowType === "stripe"
                  ? "Stripe"
                  : "Exchange",
        action: "flow_amount_continue",
        amountUsd,
      });

      if (flowType === "deposit") {
        setStack((prev) => [
          ...prev,
          { type: "waiting-deposit", nodeId, amountUsd },
        ]);
      } else if (flowType === "tron") {
        setStack((prev) => [
          ...prev,
          { type: "waiting-tron", nodeId, amountUsd },
        ]);
        fetchTronAddress(nodeId, amountUsd);
      } else if (flowType === "exchange" || flowType === "cashapp") {
        const node = findNode(nodeId, session.navTree);
        if (!isExchangeNode(node)) return;
        const { exchangeId, nodeType } = getExchangeSelection(node);
        setStack((prev) => [
          ...prev,
          { type: "exchange-page", nodeId, amountUsd },
        ]);
        fetchExchangeUrl(nodeId, exchangeId, amountUsd, nodeType);
      } else if (flowType === "stripe") {
        const node = findNode(nodeId, session.navTree);
        if (!isStripeNode(node)) return;
        setStack((prev) => [
          ...prev,
          { type: "stripe-onramp", nodeId, amountUsd },
        ]);
        fetchStripeOnramp(nodeId, amountUsd);
      }
    },
    [
      topEntry,
      session.sessionId,
      session.navTree,
      fetchTronAddress,
      fetchExchangeUrl,
      fetchStripeOnramp,
    ],
  );

  const updateWalletTxResult = useCallback(
    (txHash?: string, error?: string) => {
      setStack((prev) => {
        const top = prev[prev.length - 1];
        if (top?.type !== "wallet-sending") return prev;
        return [...prev.slice(0, -1), { ...top, txHash, error }];
      });
    },
    [],
  );

  /** Send wallet tx, setting rejected/error on the top stack entry. */
  const doWalletSend = useCallback(
    (token: WalletPaymentOption, amountUsd: number) => {
      walletFlow
        ?.sendTransaction(token, amountUsd)
        .then(({ txHash }) => updateWalletTxResult(txHash))
        .catch((err) => {
          if (isUserRejection(err)) {
            setStack((prev) => {
              const top = prev[prev.length - 1];
              if (top?.type !== "wallet-sending") return prev;
              return [...prev.slice(0, -1), { ...top, rejected: true }];
            });
            return;
          }
          updateWalletTxResult(
            undefined,
            formatUserError(err, t.transactionFailed),
          );
        });
    },
    [walletFlow, updateWalletTxResult],
  );

  const handleRetry = useCallback(() => {
    if (!topEntry) return;

    if (topEntry.type === "wallet-sending") {
      setStack((prev) => {
        const top = prev[prev.length - 1];
        if (top?.type !== "wallet-sending") return prev;
        return [...prev.slice(0, -1), { ...top, rejected: false }];
      });
      doWalletSend(topEntry.token, topEntry.amountUsd);
      return;
    }

    if (topEntry.type === "waiting-tron") {
      setStack((prev) => {
        const top = prev[prev.length - 1];
        if (top?.type !== "waiting-tron") return prev;
        return [
          ...prev.slice(0, -1),
          {
            ...top,
            address: undefined,
            expiresAt: undefined,
            trustWalletDeeplink: undefined,
            error: undefined,
          },
        ];
      });
      fetchTronAddress(topEntry.nodeId, topEntry.amountUsd);
      return;
    }

    if (topEntry.type === "exchange-page") {
      const node = findNode(topEntry.nodeId, session.navTree);
      if (!isExchangeNode(node)) return;
      const { exchangeId, nodeType } = getExchangeSelection(node);
      setStack((prev) => {
        const top = prev[prev.length - 1];
        if (top?.type !== "exchange-page") return prev;
        return [
          ...prev.slice(0, -1),
          {
            ...top,
            exchangeUrl: undefined,
            expiresAt: undefined,
            error: undefined,
          },
        ];
      });
      fetchExchangeUrl(
        topEntry.nodeId,
        exchangeId,
        topEntry.amountUsd,
        nodeType,
      );
      return;
    }

    if (topEntry.type === "stripe-onramp") {
      setStack((prev) => {
        const top = prev[prev.length - 1];
        if (top?.type !== "stripe-onramp") return prev;
        return [
          ...prev.slice(0, -1),
          {
            ...top,
            onrampSessionClientSecret: undefined,
            publishableKey: undefined,
            redirectUrl: undefined,
            error: undefined,
          },
        ];
      });
      fetchStripeOnramp(topEntry.nodeId, topEntry.amountUsd);
    }
  }, [
    topEntry,
    session.navTree,
    fetchTronAddress,
    fetchExchangeUrl,
    fetchStripeOnramp,
    doWalletSend,
  ]);

  const handleRefresh = useCallback(async () => {
    logNavEvent(session.sessionId, session.clientSecret, {
      ...getNodeCtx(),
      action: "flow_refresh",
    });

    try {
      const { session: newSession } = await client.internal.sessions.recreate(
        session.sessionId,
        session.clientSecret,
      );
      setStack([]);
      setSession(newSession);
    } catch (error) {
      console.error("failed to recreate session:", error);
    }
  }, [session.sessionId, session.clientSecret, getNodeCtx, setSession, client]);

  // ─── Wallet flow handlers ───────────────────────────────────────────────

  const pendingWalletRef = useRef<InjectedWallet | null>(null);

  const handleInjectedWalletSelect = useCallback(
    (wallet: InjectedWallet) => {
      const { name: walletName, icon: walletIcon } = wallet.info;

      if (wallet.evmProvider && wallet.solanaProvider) {
        pendingWalletRef.current = wallet;
        setStack((prev) => [
          ...prev,
          {
            type: "wallet-choose-chain",
            nodeId: "InjectedWallet",
            walletName,
            walletIcon,
          },
        ]);
        return;
      }

      setStack((prev) => [
        ...prev,
        {
          type: "wallet-connect",
          nodeId: "InjectedWallet",
          walletName,
          walletIcon,
          autoNav: true,
        },
      ]);
      if (wallet.solanaProvider) {
        walletFlow?.connectWithSolanaProvider(wallet.solanaProvider);
      } else if (wallet.evmProvider) {
        walletFlow?.connectWithProvider(wallet.evmProvider);
      }
    },
    [walletFlow],
  );

  const handleChainSelect = useCallback(
    (chain: "evm" | "solana") => {
      const wallet = pendingWalletRef.current;
      if (!wallet) return;
      const { name: walletName, icon: walletIcon } = wallet.info;

      setStack((prev) => [
        ...prev,
        {
          type: "wallet-connect",
          nodeId: "InjectedWallet",
          walletName,
          walletIcon,
          autoNav: true,
        },
      ]);

      if (chain === "solana" && wallet.solanaProvider) {
        walletFlow?.connectWithSolanaProvider(wallet.solanaProvider);
      } else if (wallet.evmProvider) {
        walletFlow?.connectWithProvider(wallet.evmProvider);
      }
    },
    [walletFlow],
  );

  const fireWalletSend = useCallback(
    (nodeId: string, token: WalletPaymentOption, amountUsd: number) => {
      setStack((prev) => [
        ...prev,
        { type: "wallet-sending", nodeId, token, amountUsd },
      ]);
      doWalletSend(token, amountUsd);
    },
    [doWalletSend],
  );

  const handleWalletSelectToken = useCallback(
    (token: WalletPaymentOption) => {
      if (topEntry?.type !== "wallet-select-token") return;
      const requiredUsd = token.required.usd;
      if (requiredUsd > 0) {
        fireWalletSend(topEntry.nodeId, token, requiredUsd);
      } else {
        setStack((prev) => [
          ...prev,
          { type: "wallet-select-amount", nodeId: topEntry.nodeId, token },
        ]);
      }
    },
    [topEntry, fireWalletSend],
  );

  const handleWalletSending = useCallback(
    (token: WalletPaymentOption, amountUsd: number) => {
      if (
        topEntry?.type !== "wallet-select-amount" &&
        topEntry?.type !== "wallet-select-token"
      )
        return;
      fireWalletSend(topEntry.nodeId, token, amountUsd);
    },
    [topEntry, fireWalletSend],
  );

  const handleShowMobileWallets = useCallback((nodeId: string) => {
    setStack((prev) => [...prev, { type: "wallet-mobile-grid", nodeId }]);
  }, []);

  // ─── Internal effects ──────────────────────────────────────────────────

  // Auto-navigate through single-option ChooseOption chains
  const autoNavRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!isOpen) return;

    if (topEntry && topEntry.type !== "choose-option") {
      return;
    }

    // Popup deep-link: land directly on the requested node.
    if (startNodeId && autoNavRef.current !== startNodeId) {
      const startNode = findNode(startNodeId, session.navTree);
      if (startNode && startNode.type !== "ChooseOption") {
        autoNavRef.current = startNodeId;
        handleNavigate(startNodeId, { autoNav: true });
        return;
      }
    }

    const currentNodeId = topEntry?.nodeId;
    let node: NavNode | null = currentNodeId
      ? findNode(currentNodeId, session.navTree)
      : (session.navTree[0] ?? null);

    let targetId: string | null = null;
    while (node?.type === "ChooseOption") {
      const chooseNode = node as NavNodeChooseOption;
      const enabled = chooseNode.options?.filter((o) => !o.disabledReason);
      if (enabled?.length !== 1) break;
      targetId = enabled[0].id;
      node = findNode(targetId, session.navTree);
    }

    if (!targetId && node && node.type !== "ChooseOption") {
      targetId = node.id;
    }

    if (targetId && autoNavRef.current !== targetId) {
      autoNavRef.current = targetId;
      handleNavigate(targetId, { autoNav: true });
    }
  }, [isOpen, topEntry, session.navTree, handleNavigate, startNodeId]);

  // Auto-advance from wallet-connect to wallet-select-token when connected
  useEffect(() => {
    if (topEntry?.type !== "wallet-connect") return;
    if (walletFlow?.isConnecting || !walletFlow?.wallet) return;
    setStack((prev) => [
      ...prev,
      { type: "wallet-select-token", nodeId: topEntry.nodeId, autoNav: true },
    ]);
  }, [topEntry, walletFlow?.wallet, walletFlow?.isConnecting]);

  // ─── Account flow handler ────────────────────────────────────────────────

  /** Advance account flow to the next screen, preserving nodeId + rail. */
  const handleAccountAdvance = useCallback(
    (nextType: AccountNavEntry["type"]) => {
      const { nodeId, rail } = accountEntry(topEntry);

      const pushPhoneEntry = (
        type: "account-loading" | "account-phone" | "account-phone-otp",
      ) => {
        setStack((prev) => {
          const nextStack = pruneCompletedAccountAuth(prev, type);
          return [...nextStack, { type, nodeId, rail } as NavEntry];
        });
      };

      if (
        nextType === "account-phone" &&
        rail === "apple_pay" &&
        accountAuth?.phone &&
        accountFlow
      ) {
        const phone = accountAuth.phone;
        pushPhoneEntry("account-loading");
        void (async () => {
          accountFlow.setPhoneNumber(phone);
          const sent = await accountFlow.sendPhoneOtp(phone, client);
          pushPhoneEntry(sent ? "account-phone-otp" : "account-phone");
        })();
        return;
      }

      setStack((prev) => {
        const nextStack = pruneCompletedAccountAuth(prev, nextType);
        return [...nextStack, { type: nextType, nodeId, rail } as NavEntry];
      });
    },
    [accountAuth, accountFlow, topEntry],
  );

  const handleAccountLogout = useCallback(() => {
    const { nodeId, rail, autoNav } = accountEntry(topEntry);
    setStack((prev) => [
      ...prev.filter((entry) => !isSameAccountRailEntry(entry, nodeId, rail)),
      { type: "account-email", nodeId, rail, autoNav },
    ]);
  }, [topEntry]);

  return useMemo(
    () => ({
      stack,
      topEntry,
      getNodeCtx,
      canGoBack,
      handleNavigate,
      handleBack,
      handleAmountContinue,
      handleRetry,
      handleRefresh,
      handleInjectedWalletSelect,
      handleChainSelect,
      handleShowMobileWallets,
      handleWalletSelectToken,
      handleWalletSending,
      handleAccountAdvance,
      handleAccountLogout,
    }),
    [
      stack,
      topEntry,
      getNodeCtx,
      canGoBack,
      handleNavigate,
      handleBack,
      handleAmountContinue,
      handleRetry,
      handleRefresh,
      handleInjectedWalletSelect,
      handleChainSelect,
      handleShowMobileWallets,
      handleWalletSelectToken,
      handleWalletSending,
      handleAccountAdvance,
      handleAccountLogout,
    ],
  );
}
