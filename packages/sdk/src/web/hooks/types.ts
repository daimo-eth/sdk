import type {
  AccountDepositStatus,
  AccountEnrollmentUpdateApplePayEnhancedVerification,
  AccountRail,
  DepositPaymentInteraction,
} from "../../common/account.js";
import type { HostedPaymentQuote } from "../../common/api.js";
import type { NavNode, SessionWithNav } from "../api/navTree.js";
import type { WalletPaymentOption } from "../api/walletTypes.js";

export type { SessionWithNav };

type AccountNavBase = {
  nodeId: string;
  rail: AccountRail;
  paymentInteraction: DepositPaymentInteraction;
  autoNav?: boolean;
};

/**
 * A single entry in the navigation stack. Back = pop.
 * autoNav marks entries pushed by auto-navigation (single-option chains).
 */
export type NavEntry =
  | { type: "choose-option"; nodeId: string; autoNav: boolean }
  | { type: "deeplink"; nodeId: string; autoNav?: boolean }
  | {
      type: "select-amount";
      nodeId: string;
      flowType:
        | "deposit"
        | "tron"
        | "exchange"
        | "cashapp"
        | "hosted"
        | "stripe";
      autoNav?: boolean;
    }
  | {
      type: "waiting-deposit";
      nodeId: string;
      amountUsd: number;
      autoNav?: boolean;
    }
  | {
      type: "waiting-tron";
      nodeId: string;
      amountUsd: number;
      address?: string;
      expiresAt?: number;
      trustWalletDeeplink?: {
        url: string;
        label: "USDT on Tron";
      };
      error?: string;
      autoNav?: boolean;
    }
  | {
      type: "external-payment";
      nodeId: string;
      sourceAmount: number;
      paymentUrl?: string;
      waitingMessage?: string;
      expiresAt?: number;
      quote?: HostedPaymentQuote;
      error?: string;
      autoNav?: boolean;
    }
  | {
      type: "stripe-onramp";
      nodeId: string;
      amountUsd: number;
      onrampSessionClientSecret?: string;
      publishableKey?: string;
      redirectUrl?: string;
      error?: string;
      autoNav?: boolean;
    }
  | { type: "wallet-mobile-grid"; nodeId: string; autoNav?: boolean }
  | {
      type: "wallet-choose-chain";
      nodeId: string;
      walletName: string;
      walletIcon: string;
      autoNav?: boolean;
    }
  | {
      type: "wallet-connect";
      nodeId: string;
      walletName?: string;
      walletIcon?: string;
      autoNav?: boolean;
    }
  | { type: "wallet-select-token"; nodeId: string; autoNav?: boolean }
  | {
      type: "wallet-select-amount";
      nodeId: string;
      token: WalletPaymentOption;
      autoNav?: boolean;
    }
  | {
      type: "wallet-sending";
      nodeId: string;
      token: WalletPaymentOption;
      amountUsd: number;
      txHash?: string;
      error?: string;
      rejected?: boolean;
      autoNav?: boolean;
    }
  // Not "account-" prefixed: the session-terminal success page must take
  // over when the payment completes in the popup.
  | ({ type: "fiat-popup" } & AccountNavBase)
  | ({ type: "account-email" } & AccountNavBase)
  | ({ type: "account-loading" } & AccountNavBase)
  | ({ type: "account-otp" } & AccountNavBase)
  | ({ type: "account-phone" } & AccountNavBase)
  | ({ type: "account-phone-otp" } & AccountNavBase)
  | ({ type: "account-creating-wallet" } & AccountNavBase)
  | ({ type: "account-enrollment" } & AccountNavBase)
  | ({
      type: "account-enrollment-update";
      update: AccountEnrollmentUpdateApplePayEnhancedVerification;
    } & AccountNavBase)
  | ({ type: "account-amount" } & AccountNavBase)
  | ({ type: "account-approval"; resumePayment?: boolean } & AccountNavBase)
  | ({ type: "account-payment-resume" } & AccountNavBase)
  | ({
      type: "account-request-to-pay";
      resumePayment?: boolean;
    } & AccountNavBase)
  | ({ type: "account-institution-picker" } & AccountNavBase)
  | ({ type: "account-institution-review" } & AccountNavBase)
  | ({ type: "account-payment-instructions" } & AccountNavBase)
  | ({ type: "account-wallet-pay" } & AccountNavBase)
  | ({ type: "account-stripe-onramp" } & AccountNavBase)
  | ({ type: "account-deeplink" } & AccountNavBase)
  | ({
      type: "account-status";
      initialStatus?: AccountDepositStatus;
    } & AccountNavBase)
  | ({ type: "account-error"; message: string } & AccountNavBase);

export type AccountNavEntry = Extract<NavEntry, { rail: AccountRail }>;

export type DaimoModalEventHandlers = {
  onPaymentStarted?: () => void;
  onPaymentCompleted?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/** Helper to find a node by ID in the nav tree */
export function findNode(nodeId: string, nodes: NavNode[]): NavNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.type !== "ChooseOption") continue;
    const found = findNode(nodeId, node.options);
    if (found) return found;
  }
  return null;
}

/** Helper to find a node by type in the nav tree */
export function findNodeByType(type: string, nodes: NavNode[]): NavNode | null {
  for (const node of nodes) {
    if (node.type === type) return node;
    if (node.type !== "ChooseOption") continue;
    const found = findNodeByType(type, node.options);
    if (found) return found;
  }
  return null;
}
