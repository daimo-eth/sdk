import type { Address } from "viem";
import type {
  AccountRail,
  DepositPaymentInteraction,
} from "../../common/account.js";
import type { ExchangeId } from "../../common/api.js";
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

/** External deeplink. Opens directly on mobile; defaults to QR on desktop. */
export type NavNodeDeeplink = NavNodeCommon & {
  type: "Deeplink";
  url: string;
  icon?: string;
  pageIcon?: string;
  desktopBehavior?: "popup" | "qr";
};

export type NavNodeExchange = NavNodeCommon & {
  type: "Exchange";
  exchangeId: ExchangeId;
  icon?: string;
  requiredUsd?: number;
  minimumUsd: number;
  maximumUsd: number;
};

export type NavNodeCashApp = NavNodeCommon & {
  type: "CashApp";
  icon?: string;
  requiredUsd?: number;
  minimumUsd: number;
  maximumUsd: number;
};

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
  | NavNodeStripe
  | NavNodeTronDeposit
  | NavNodeConnectedWallet
  | NavNodeFiat;
