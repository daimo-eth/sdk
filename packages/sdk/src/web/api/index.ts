import type { SessionNavInfo, SessionWithNav } from "./navTree.js";
import type { WalletPaymentOption } from "./walletTypes.js";

export type {
  NavNodeCashApp,
  NavNode,
  NavNodeChooseOption,
  NavNodeConnectedWallet,
  NavNodeDeeplink,
  NavNodeDepositAddress,
  NavNodeExchange,
  NavNodeFiat,
  NavNodeKycRequirement,
  NavNodeKycRequirementDisplayItem,
  NavNodeKycRequirementIcon,
  NavNodeKycRequirementItem,
  NavNodeKycRequirementKind,
  NavNodeTronDeposit,
  SessionNavInfo,
  SessionWithNav,
} from "./navTree.js";

export type {
  DaimoPayToken,
  DaimoPayTokenAmount,
  WalletPaymentOption,
} from "./walletTypes.js";

export type AccountAuthHint = {
  /** Email to prefill and start OTP auth for fiat/account deposits. */
  email?: string;
  /** E.164 phone number to prefill and start SMS OTP for Apple Pay. */
  phone?: string;
};

export type AccountAuthConfig = AccountAuthHint & {
  /** Embedded auth app ID used for account deposit flows. */
  privyAppId: string;
};

export type NavLocation = {
  countryCode: string | null;
  countryName: string;
  emoji: string;
};

export type NavLocationOption = {
  countryCode: string;
  countryName: string;
  emoji: string;
};

export type RetrieveSessionWithNavResponse = {
  session: SessionNavInfo;
  /** Server-effective location used to build the nav tree. */
  location: NavLocation;
  /** Curated locations that can be selected in the modal country picker. */
  locationOptions: NavLocationOption[];
  /** Account auth config, present when the nav tree includes Fiat. */
  accountAuth?: AccountAuthConfig;
};

export type RecreateSessionWithNavResponse = {
  session: SessionWithNav;
  /** Server-effective location used to build the nav tree. */
  location: NavLocation;
  /** Curated locations that can be selected in the modal country picker. */
  locationOptions: NavLocationOption[];
  /** Account auth config, present when the nav tree includes Fiat. */
  accountAuth?: AccountAuthConfig;
};

export type WalletOptionsResponse = WalletPaymentOption[];
