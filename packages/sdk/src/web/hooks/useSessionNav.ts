import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AccountDeposit,
  AccountDepositStatus,
  AccountRail,
} from "../../common/account.js";
import type {
  CreatePaymentMethodRequest,
  ExchangeId,
} from "../../common/api.js";
import type {
  AccountAuthConfig,
  DaimoCountryCode,
  RecreateSessionWithNavResponse,
} from "../api/index.js";
import {
  formatNavSourceAmountUnits,
  getNavSourceAmount,
} from "../api/navTree.js";
import type {
  NavExternalPaymentNode,
  NavNode,
  NavNodeChooseOption,
  NavNodeFiat,
  NavNodeStripe,
  NavNodeTronDeposit,
  SessionWithNav,
} from "../api/navTree.js";
import type { WalletPaymentOption } from "../api/walletTypes.js";

import {
  getAccountPaymentEntryTarget,
  getDepositResumeTarget,
  shouldRecoverExpiredPayment,
} from "../components/account/accountNav.js";
import { getNodePaymentInteraction } from "../components/account/accountPaymentCompatibility.js";
import {
  recreateAccountPaymentSession,
  runAccountSessionRecreateOnce,
} from "../components/account/accountSessionRecreate.js";
import { detectPlatform, isDesktop, type DaimoPlatform } from "../platform.js";
import {
  interactionRequiresPopup,
  isFramed,
} from "../components/account/fiatPopup.js";
import { pruneCompletedAccountAuth } from "./accountAuthNav.js";
import { useDaimoClient } from "./DaimoClientContext.js";
import { t } from "./locale.js";
import { createNavLogger, type NavNodeType } from "./navEvent.js";
import { findNode, type AccountNavEntry, type NavEntry } from "./types.js";
import type { AccountFlowState } from "./useAccountFlow.js";
import type { InjectedWallet } from "./useInjectedWallets.js";
import { isUserRejection, type WalletFlowResult } from "./useWalletFlow.js";

type NodeContext = { nodeId: string | null; nodeType: NavNodeType | null };

type SessionNavResult = {
  stack: NavEntry[];
  topEntry: NavEntry | null;
  getNodeCtx: () => NodeContext;
  canGoBack: boolean;

  handleNavigate: (nodeId: string, options?: { autoNav?: boolean }) => void;
  handleBack: () => void;
  handleReset: () => void;
  handleAmountContinue: (amount: number) => void;
  handleRetry: () => void;
  handleRefresh: () => Promise<void>;
  handleAccountSessionRecreate: (depositAmount: string) => Promise<void>;

  handleInjectedWalletSelect: (wallet: InjectedWallet) => void;
  handleChainSelect: (chain: "evm" | "solana") => void;
  handleWalletSelectToken: (token: WalletPaymentOption) => void;
  handleWalletSending: (token: WalletPaymentOption, amountUsd: number) => void;

  handleShowMobileWallets: (nodeId: string) => void;

  /** Advance account flow to the next screen. */
  handleAccountAdvance: (
    nextType: AccountNavEntry["type"],
    options?: { initialStatus?: AccountDepositStatus },
  ) => void;
  /** Reset the current account rail after logout. */
  handleAccountLogout: () => void;
};

function isExternalPaymentNode(
  node: NavNode | null,
): node is NavExternalPaymentNode {
  return (
    node?.type === "Exchange" ||
    node?.type === "CashApp" ||
    node?.type === "HostedPayment"
  );
}

function isStripeNode(node: NavNode | null): node is NavNodeStripe {
  return node?.type === "Stripe";
}

function isTrustTronNode(node: NavNode | null): node is NavNodeTronDeposit {
  return node?.type === "TronDeposit" && node.id === "Trust-Tron";
}

function getExternalPaymentSelection(node: NavExternalPaymentNode):
  | {
      kind: "exchange";
      exchangeId: ExchangeId;
      nodeType: "Exchange" | "CashApp";
    }
  | {
      kind: "hosted";
      hostedPaymentMethodId: string;
      countryCode: string;
      nodeType: "HostedPayment";
    } {
  if (node.type === "HostedPayment") {
    return {
      kind: "hosted",
      hostedPaymentMethodId: node.hostedPaymentMethodId,
      countryCode: node.countryCode,
      nodeType: "HostedPayment",
    };
  }
  if (node.type === "CashApp") {
    return { kind: "exchange", exchangeId: "CashApp", nodeType: "CashApp" };
  }
  return {
    kind: "exchange",
    exchangeId: node.exchangeId,
    nodeType: "Exchange",
  };
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
    /** Selected country used when rebuilding nav for a recreated session. */
    countryCode?: DaimoCountryCode;
    /** Propagates non-session fields from the recreate response. */
    onRecreate?: (response: RecreateSessionWithNavResponse) => void;
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
  const countryCode = options?.countryCode;
  const onRecreate = options?.onRecreate;
  const accountRecreateRef = useRef<Promise<void> | null>(null);
  const recreatedAmountRef = useRef<
    { sessionId: string; depositAmount: string } | undefined
  >(undefined);
  const autoNavRef = useRef<string | null>(null);

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

  const fetchExternalPayment = useCallback(
    async (nodeId: string, node: NavExternalPaymentNode, amount: number) => {
      const selection = getExternalPaymentSelection(node);
      const sourceAmount = getNavSourceAmount(node);
      const sourceAmountUnits = formatNavSourceAmountUnits(
        amount,
        sourceAmount,
      );
      const paymentMethod: CreatePaymentMethodRequest["paymentMethod"] =
        selection.kind === "hosted"
          ? {
              type: "hosted",
              hostedPaymentMethodId: selection.hostedPaymentMethodId,
              countryCode: selection.countryCode,
              sourceAmount: {
                units: sourceAmountUnits,
                currency: sourceAmount.currency,
              },
              platform: effectivePlatform,
            }
          : {
              type: "exchange",
              exchangeId: selection.exchangeId,
              amountUsd: amount,
              platform: effectivePlatform,
            };
      try {
        const result = await client.sessions.paymentMethods.create(
          session.sessionId,
          {
            clientSecret: session.clientSecret,
            paymentMethod,
          },
        );
        const payment = result.externalPayment ?? result.exchange;
        if (payment == null) {
          throw new Error("external payment details not returned");
        }
        const paymentMethodId =
          selection.kind === "hosted"
            ? selection.hostedPaymentMethodId
            : selection.exchangeId;
        logNavEvent(session.sessionId, session.clientSecret, {
          nodeId,
          nodeType: selection.nodeType,
          action: "flow_external_payment",
          paymentMethodId,
          success: true,
          url: payment.url,
        });
        setStack((prev) => {
          const top = prev[prev.length - 1];
          if (top?.type !== "external-payment" || top.nodeId !== nodeId)
            return prev;
          return [
            ...prev.slice(0, -1),
            {
              ...top,
              paymentUrl: payment.url,
              waitingMessage: payment.waitingMessage,
              expiresAt: payment.expiresAt,
              quote: result.externalPayment?.quote,
              error: undefined,
            },
          ];
        });
      } catch (error) {
        console.error("failed to create external payment:", error);
        const errorMsg =
          error instanceof Error
            ? error.message
            : "failed to create external payment";
        const paymentMethodId =
          selection.kind === "hosted"
            ? selection.hostedPaymentMethodId
            : selection.exchangeId;
        logNavEvent(session.sessionId, session.clientSecret, {
          nodeId,
          nodeType: selection.nodeType,
          action: "flow_external_payment",
          paymentMethodId,
          success: false,
          error: errorMsg,
        });
        setStack((prev) => {
          const top = prev[prev.length - 1];
          if (top?.type !== "external-payment" || top.nodeId !== nodeId)
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
    async (
      nodeId: string,
      node: NavNodeFiat,
      autoNav: boolean,
      options?: { popupRequired?: boolean },
    ) => {
      const rail = node.fiatMethod;
      const paymentInteraction = getNodePaymentInteraction(node);
      setStack((prev) => [
        ...prev,
        {
          type: "account-loading",
          nodeId,
          rail,
          paymentInteraction,
          autoNav,
        },
      ]);

      const replaceLoading = (entry: NavEntry) => {
        setStack((prev) =>
          replacePendingAccountEntry(prev, nodeId, rail, entry),
        );
      };

      // Resume: if this session already has a deposit past payment, jump
      // straight to the status screen. getDeposit is auth-free (clientSecret
      // only), so a finished deposit never shows a login screen.
      let existingDeposit: AccountDeposit | null = null;
      try {
        const response = await client.account.getDeposit({
          sessionId: session.sessionId,
          clientSecret: session.clientSecret,
          refresh: true,
        });
        existingDeposit = response.deposit;
        const resumeType =
          existingDeposit &&
          getDepositResumeTarget(existingDeposit.status, paymentInteraction);
        if (existingDeposit && resumeType) {
          replaceLoading({
            type: resumeType,
            nodeId,
            rail,
            paymentInteraction,
            autoNav,
            initialStatus: existingDeposit.status,
          });
          return;
        }
      } catch (err) {
        console.error("[account-nav] deposit resume check failed:", err);
        // fall through to the normal enrollment/auth flow
      }

      if (options?.popupRequired) {
        replaceLoading({
          type: "fiat-popup",
          nodeId,
          rail,
          paymentInteraction,
          autoNav,
        });
        return;
      }

      if (!accountFlow) {
        replaceLoading({
          type: "account-error",
          nodeId,
          rail,
          paymentInteraction,
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
            if (
              existingDeposit &&
              shouldRecoverExpiredPayment(
                existingDeposit.status,
                paymentInteraction,
              )
            ) {
              accountFlow.setDepositState(session.sessionId, {
                depositAmount: existingDeposit.fiatAmount,
                kind: "idle",
              });
              replaceLoading({
                type: "account-payment-resume",
                nodeId,
                rail,
                paymentInteraction,
                autoNav,
              });
              return;
            }

            if (
              existingDeposit &&
              (existingDeposit.status === "initiated" ||
                existingDeposit.status === "awaiting_payment") &&
              (paymentInteraction === "request-to-pay" ||
                paymentInteraction === "institution-picker" ||
                paymentInteraction === "hosted-approval" ||
                paymentInteraction === "external-app-approval")
            ) {
              accountFlow.setDepositState(session.sessionId, {
                depositAmount: existingDeposit.fiatAmount,
                kind: "idle",
              });
              replaceLoading({
                type: "account-payment-resume",
                nodeId,
                rail,
                paymentInteraction,
                autoNav,
              });
              return;
            }

            const recreatedAmount = recreatedAmountRef.current;
            if (recreatedAmount?.sessionId === session.sessionId) {
              recreatedAmountRef.current = undefined;
              if (paymentInteraction === "request-to-pay") {
                replaceLoading({
                  type: "account-request-to-pay",
                  nodeId,
                  rail,
                  paymentInteraction,
                  autoNav,
                });
                return;
              }
            }

            // Some rails skip the amount-first step and go straight to a
            // unified payment page.
            const entryType = getAccountPaymentEntryTarget(paymentInteraction);
            replaceLoading({
              type: entryType,
              nodeId,
              rail,
              paymentInteraction,
              autoNav,
            });
            return;
          }
          if (result.nextAction === "enrollment") {
            replaceLoading({
              type: "account-enrollment",
              nodeId,
              rail,
              paymentInteraction,
              autoNav,
            });
            return;
          }
          if (result.nextAction === "enrollment_update") {
            replaceLoading({
              type: "account-enrollment-update",
              nodeId,
              rail,
              paymentInteraction,
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
          replaceLoading({
            type: "account-otp",
            nodeId,
            rail,
            paymentInteraction,
            autoNav,
          });
          return;
        }
      }

      // New user or no email hint — start from email
      replaceLoading({
        type: "account-email",
        nodeId,
        rail,
        paymentInteraction,
        autoNav,
      });
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

      if (isExternalPaymentNode(targetNode)) {
        const required = getNavSourceAmount(targetNode).required ?? 0;
        if (required > 0) {
          setStack((prev) => [
            ...prev,
            {
              type: "external-payment",
              nodeId,
              sourceAmount: required,
              autoNav,
            },
          ]);
          fetchExternalPayment(nodeId, targetNode, required);
          return;
        }
        setStack((prev) => [
          ...prev,
          {
            type: "select-amount",
            nodeId,
            flowType:
              targetNode.type === "CashApp"
                ? "cashapp"
                : targetNode.type === "HostedPayment"
                  ? "hosted"
                  : "exchange",
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
        const popupRequired =
          enableFiatPopup &&
          interactionRequiresPopup(getNodePaymentInteraction(targetNode)) &&
          isFramed();
        handleAccountNavigate(nodeId, targetNode, autoNav, { popupRequired });
        return;
      }
    },
    [
      session.navTree,
      session.sessionId,
      getNodeCtx,
      fetchTronAddress,
      fetchExternalPayment,
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
    (amount: number) => {
      if (!topEntry || topEntry.type !== "select-amount") return;
      const { nodeId, flowType } = topEntry;
      const selectedNode = findNode(nodeId, session.navTree);
      const selectedSourceAmount = isExternalPaymentNode(selectedNode)
        ? getNavSourceAmount(selectedNode)
        : null;
      const amountContext =
        (flowType === "exchange" ||
          flowType === "cashapp" ||
          flowType === "hosted") &&
        selectedSourceAmount != null
          ? {
              sourceAmountUnits: formatNavSourceAmountUnits(
                amount,
                selectedSourceAmount,
              ),
              sourceCurrency: selectedSourceAmount.currency,
            }
          : { amountUsd: amount };

      logNavEvent(session.sessionId, session.clientSecret, {
        nodeId,
        nodeType:
          flowType === "deposit"
            ? "DepositAddress"
            : flowType === "tron"
              ? "TronDeposit"
              : flowType === "cashapp"
                ? "CashApp"
                : flowType === "hosted"
                  ? "HostedPayment"
                  : flowType === "stripe"
                    ? "Stripe"
                    : "Exchange",
        action: "flow_amount_continue",
        ...amountContext,
      });

      if (flowType === "deposit") {
        setStack((prev) => [
          ...prev,
          { type: "waiting-deposit", nodeId, amountUsd: amount },
        ]);
      } else if (flowType === "tron") {
        setStack((prev) => [
          ...prev,
          { type: "waiting-tron", nodeId, amountUsd: amount },
        ]);
        fetchTronAddress(nodeId, amount);
      } else if (
        flowType === "exchange" ||
        flowType === "cashapp" ||
        flowType === "hosted"
      ) {
        if (!isExternalPaymentNode(selectedNode)) return;
        setStack((prev) => [
          ...prev,
          { type: "external-payment", nodeId, sourceAmount: amount },
        ]);
        fetchExternalPayment(nodeId, selectedNode, amount);
      } else if (flowType === "stripe") {
        if (!isStripeNode(selectedNode)) return;
        setStack((prev) => [
          ...prev,
          { type: "stripe-onramp", nodeId, amountUsd: amount },
        ]);
        fetchStripeOnramp(nodeId, amount);
      }
    },
    [
      topEntry,
      session.sessionId,
      session.navTree,
      fetchTronAddress,
      fetchExternalPayment,
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
          // Store the raw message: the error page formats it for display
          // and passes the raw text on to contact support.
          const raw = err instanceof Error ? err.message : String(err ?? "");
          updateWalletTxResult(undefined, raw || t.transactionFailed);
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

    if (topEntry.type === "external-payment") {
      const node = findNode(topEntry.nodeId, session.navTree);
      if (!isExternalPaymentNode(node)) return;
      setStack((prev) => {
        const top = prev[prev.length - 1];
        if (top?.type !== "external-payment") return prev;
        return [
          ...prev.slice(0, -1),
          {
            ...top,
            paymentUrl: undefined,
            expiresAt: undefined,
            error: undefined,
          },
        ];
      });
      fetchExternalPayment(topEntry.nodeId, node, topEntry.sourceAmount);
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
    fetchExternalPayment,
    fetchStripeOnramp,
    doWalletSend,
  ]);

  const handleRefresh = useCallback(async () => {
    logNavEvent(session.sessionId, session.clientSecret, {
      ...getNodeCtx(),
      action: "flow_refresh",
    });

    try {
      const response = await client.internal.sessions.recreate(
        session.sessionId,
        session.clientSecret,
        { countryCode },
      );
      setStack([]);
      setSession(response.session);
      onRecreate?.(response);
    } catch (error) {
      console.error("failed to recreate session:", error);
    }
  }, [
    session.sessionId,
    session.clientSecret,
    countryCode,
    getNodeCtx,
    setSession,
    client,
    onRecreate,
  ]);

  const handleAccountSessionRecreate = useCallback(
    async (depositAmount: string) => {
      await runAccountSessionRecreateOnce(accountRecreateRef, async () => {
        const response = await recreateAccountPaymentSession({
          depositAmount,
          recreate: () =>
            client.internal.sessions.recreate(
              session.sessionId,
              session.clientSecret,
              { countryCode },
            ),
          setDepositState: (sessionId, state) =>
            accountFlow?.setDepositState(sessionId, state),
        });
        recreatedAmountRef.current = {
          sessionId: response.session.sessionId,
          depositAmount,
        };
        autoNavRef.current = null;
        setStack([]);
        setSession(response.session);
        onRecreate?.(response);
      });
    },
    [
      accountFlow,
      client,
      countryCode,
      onRecreate,
      session.clientSecret,
      session.sessionId,
      setSession,
    ],
  );

  const handleReset = useCallback(() => setStack([]), []);

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
    (
      nextType: AccountNavEntry["type"],
      options?: { initialStatus?: AccountDepositStatus },
    ) => {
      const { nodeId, rail, paymentInteraction } = accountEntry(topEntry);

      const pushPhoneEntry = (
        type: "account-loading" | "account-phone" | "account-phone-otp",
      ) => {
        setStack((prev) => {
          const nextStack = pruneCompletedAccountAuth(prev, type);
          return [
            ...nextStack,
            { type, nodeId, rail, paymentInteraction } as NavEntry,
          ];
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
        return [
          ...nextStack,
          {
            type: nextType,
            nodeId,
            rail,
            paymentInteraction,
            ...options,
          } as NavEntry,
        ];
      });
    },
    [accountAuth, accountFlow, topEntry],
  );

  const handleAccountLogout = useCallback(() => {
    const { nodeId, rail, paymentInteraction, autoNav } =
      accountEntry(topEntry);
    setStack((prev) => [
      ...prev.filter((entry) => !isSameAccountRailEntry(entry, nodeId, rail)),
      { type: "account-email", nodeId, rail, paymentInteraction, autoNav },
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
      handleReset,
      handleAmountContinue,
      handleRetry,
      handleRefresh,
      handleAccountSessionRecreate,
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
      handleReset,
      handleAmountContinue,
      handleRetry,
      handleRefresh,
      handleAccountSessionRecreate,
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
