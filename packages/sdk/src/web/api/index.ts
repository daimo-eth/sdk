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
  NavSourceAmount,
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

declare const daimoCountryCodeBrand: unique symbol;

/** Normalized ISO-3166 alpha-2 country code used by Daimo location controls. */
export type DaimoCountryCode = string & {
  readonly [daimoCountryCodeBrand]: true;
};

export function parseDaimoCountryCode(
  value: string | null | undefined,
): DaimoCountryCode | null {
  const code = value?.trim().toUpperCase();
  if (!code || code === "XX" || code === "T1") return null;
  return /^[A-Z]{2}$/.test(code) ? (code as DaimoCountryCode) : null;
}

export type NavLocation = {
  countryCode: DaimoCountryCode | null;
  countryName: string;
  emoji: string;
};

export type NavLocationOption = {
  countryCode: DaimoCountryCode;
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
