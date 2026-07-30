import type { Address } from "viem";
import type {
  AccountRail,
  DepositPaymentInteraction,
} from "../../common/account.js";
import type { ExchangeId } from "../../common/api.js";
import type { ExternalPaymentMethodId } from "../../common/externalPayment.js";
import type { SessionPublicInfo } from "../../common/session.js";

/** Session plus server-defined modal navigation data. */
export type SessionNavInfo = SessionPublicInfo & {
  /** Server-defined nav */
  navTree: NavNode[];
  /** Base URL for receipt links and icon resolution (set by server). */
  baseUrl: string;
};

/** Session with navigation tree for the modal UI. */
export type SessionWithNav = SessionNavInfo & {
  /** Client secret for session updates */
  clientSecret: string;
};

type NavNodeCommon = {
  id: string;
  title: string;
  label?: string;
  icons?: string[];
  /** When set, option is shown but not selectable, with this reason displayed. */
  disabledReason?: string;
};

export type NavNodeKycRequirementItem =
  | "personal_info"
  | "government_id"
  | "selfie"
  | "phone_number"
  | "email";

export type NavNodeKycRequirementKind =
  | "none"
  | "phone"
  | "email"
  | "phone_and_email"
  | "id_only"
  | "id_and_selfie"
  | "personal_info";

export type NavNodeKycRequirementIcon = "shield" | "person" | "id_card";

export type NavNodeKycRequirementDisplayItem = {
  id: NavNodeKycRequirementItem;
  label: string;
};

export type NavNodeKycRequirement = {
  kind: NavNodeKycRequirementKind;
  icon: NavNodeKycRequirementIcon;
  label: string;
  rowLabel: string;
  detailTitle: string;
  summary: string;
  requirements: NavNodeKycRequirementDisplayItem[];
  estimatedTime?: string;
};

export type NavNodeChooseOption = NavNodeCommon & {
  type: "ChooseOption";
  options: NavNode[];
  layout?: "list" | "grid";
};

export type NavNodeDepositAddress = NavNodeCommon & {
  type: "DepositAddress";
  address: Address;
  chainId: number;
  icon?: string;
  requiredUsd?: number;
  minimumUsd: number;
  maximumUsd: number;
  expiresAt: number;
  tokenSuffix: string;
};

/** Mobile wallet deeplink. Opens directly on mobile; shows as QR code on desktop. */
export type NavNodeDeeplink = NavNodeCommon & {
  type: "Deeplink";
  url: string;
  icon?: string;
  pageIcon?: string;
};

export type NavSourceAmount = {
  /** ISO 4217 source currency selected by the backend. */
  currency: string;
  /** Presentation symbol selected by the backend, for example "$" or "€". */
  currencySymbol: string;
  /** Decimal places submitted to the backend. */
  decimals: number;
  required?: number;
  minimum: number;
  maximum: number;
};

export type NavExternalHandoff = {
  desktopBehavior: "popup" | "qr";
  popupName?: string;
};

export type NavNodeExchange = NavNodeCommon & {
  type: "Exchange";
  exchangeId: ExchangeId;
  icon?: string;
  /** Backend-owned amount and currency policy. Optional for old servers. */
  sourceAmount?: NavSourceAmount;
  /** Backend-owned external handoff presentation. Optional for old servers. */
  externalHandoff?: NavExternalHandoff;
  /** @deprecated Use sourceAmount.required. */
  requiredUsd?: number;
  /** @deprecated Use sourceAmount.minimum. */
  minimumUsd: number;
  /** @deprecated Use sourceAmount.maximum. */
  maximumUsd: number;
};

export type NavNodeCashApp = NavNodeCommon & {
  type: "CashApp";
  icon?: string;
  /**
   * Present when the server accepts the external-payment request for Cash App.
   * Its absence preserves compatibility with pre-external-payment servers.
   */
  externalPaymentMethodId?: "CashApp";
  /** Backend-owned amount and currency policy. Optional for old servers. */
  sourceAmount?: NavSourceAmount;
  /** Backend-owned external handoff presentation. Optional for old servers. */
  externalHandoff?: NavExternalHandoff;
  requiredUsd?: number;
  minimumUsd: number;
  maximumUsd: number;
};

/**
 * Generic external payment handoff. The SDK renders the interaction without
 * knowing which implementation owns the method ID.
 */
export type NavNodeExternalPayment = NavNodeCommon & {
  type: "ExternalPayment";
  externalPaymentMethodId: ExternalPaymentMethodId;
  /** ISO-3166 alpha-2 country to echo when initiating this payment. */
  countryCode?: string;
  icon?: string;
  sourceAmount: NavSourceAmount;
  externalHandoff: NavExternalHandoff;
};

export type NavExternalPaymentNode =
  | NavNodeExchange
  | NavNodeCashApp
  | NavNodeExternalPayment;

/** Compatibility fallback for nav trees produced by pre-sourceAmount servers. */
export function getNavSourceAmount(
  node: NavExternalPaymentNode,
): NavSourceAmount {
  if (node.type === "ExternalPayment") return node.sourceAmount;
  if (node.sourceAmount != null) return node.sourceAmount;
  return {
    currency: "USD",
    currencySymbol: "$",
    decimals: 2,
    required: node.requiredUsd,
    minimum: node.minimumUsd,
    maximum: node.maximumUsd,
  };
}

/** Compatibility fallback for nav trees produced by pre-handoff servers. */
export function getNavExternalHandoff(
  node: NavExternalPaymentNode,
): NavExternalHandoff & {
  legacyQrPlaceholderDensity?: "short" | "medium" | "long";
} {
  if (node.type === "ExternalPayment") return node.externalHandoff;
  if (node.externalHandoff != null) return node.externalHandoff;
  return getLegacyNavExternalHandoff(node);
}

/** Preserve pre-handoff SDK behavior while old backend nav trees remain valid. */
function getLegacyNavExternalHandoff(
  node: NavNodeExchange | NavNodeCashApp,
): NavExternalHandoff & {
  legacyQrPlaceholderDensity: "short" | "medium";
} {
  const exchangeId = node.type === "CashApp" ? "CashApp" : node.exchangeId;
  return {
    desktopBehavior:
      exchangeId === "Coinbase" || exchangeId === "MtPelerin" ? "popup" : "qr",
    legacyQrPlaceholderDensity:
      exchangeId === "Binance" ||
      exchangeId === "BinanceUSDC" ||
      exchangeId === "BinanceUSDT"
        ? "medium"
        : "short",
  };
}

/** Format an amount exactly as required by the backend-owned source policy. */
export function formatNavSourceAmountUnits(
  amount: number,
  sourceAmount: NavSourceAmount,
): string {
  if (
    !Number.isFinite(amount) ||
    !Number.isInteger(sourceAmount.decimals) ||
    sourceAmount.decimals < 0 ||
    sourceAmount.decimals > 20
  ) {
    throw new Error("invalid external payment amount");
  }
  return amount.toFixed(sourceAmount.decimals);
}

export type NavNodeStripe = NavNodeCommon & {
  type: "Stripe";
  icon?: string;
  requiredUsd?: number;
  minimumUsd: number;
  maximumUsd: number;
};

export type NavNodeTronDeposit = NavNodeCommon & {
  type: "TronDeposit";
  icon?: string;
  requiredUsd?: number;
  minimumUsd: number;
  maximumUsd: number;
};

export type NavNodeConnectedWallet = NavNodeCommon & {
  type: "ConnectedWallet";
  icon?: string;
  /** When true, proactively call eth_requestAccounts. Default false (passive). */
  autoconnect?: boolean;
};

export type NavNodeFiat = NavNodeCommon & {
  type: "Fiat";
  fiatMethod: AccountRail;
  /** Semantic entry flow. Optional only while old servers remain supported. */
  paymentInteraction?: DepositPaymentInteraction;
  icon?: string;
  kycRequirement?: NavNodeKycRequirement;
};

export type NavNode =
  | NavNodeChooseOption
  | NavNodeDepositAddress
  | NavNodeDeeplink
  | NavNodeExchange
  | NavNodeCashApp
  | NavNodeExternalPayment
  | NavNodeStripe
  | NavNodeTronDeposit
  | NavNodeConnectedWallet
  | NavNodeFiat;
