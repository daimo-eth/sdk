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

export type AccountAuthConfig = {
  /** Embedded auth app ID used for account deposit flows. */
  privyAppId: string;
  /** Email to prefill and start OTP auth for fiat/account deposits. */
  email?: string;
};

export type RetrieveSessionWithNavResponse = {
  session: SessionNavInfo;
  /** Account auth config, present when the nav tree includes Fiat. */
  accountAuth?: AccountAuthConfig;
};

export type RecreateSessionWithNavResponse = {
  session: SessionWithNav;
  /** Account auth config, present when the nav tree includes Fiat. */
  accountAuth?: AccountAuthConfig;
};

export type WalletOptionsResponse = WalletPaymentOption[];
