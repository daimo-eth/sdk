import type { GetAccountResponse } from "../../common/account.js";
import type { NavEntry } from "./types.js";

type ExistingAccountResponse = Exclude<GetAccountResponse, { account: null }>;

export type AccountAuthDecision =
  | { type: "email-hint" }
  | { type: "error" }
  | { type: "create-account" }
  | { type: "existing-account"; response: ExistingAccountResponse };

type AccountAuthChallengeEntryType = Extract<
  NavEntry["type"],
  "account-otp" | "account-phone-otp"
>;
type AccountAuthEntryType = Extract<
  NavEntry["type"],
  "account-email" | "account-otp" | "account-phone" | "account-phone-otp"
>;

const ACCOUNT_AUTH_CHALLENGE_ENTRY_TYPES =
  new Set<AccountAuthChallengeEntryType>(["account-otp", "account-phone-otp"]);

const ACCOUNT_AUTH_ENTRY_TYPES = new Set<AccountAuthEntryType>([
  "account-email",
  "account-otp",
  "account-phone",
  "account-phone-otp",
]);

/** An authenticated Privy identity always takes priority over session hints. */
export function getAccountAuthDecision(params: {
  isAuthenticated: boolean;
  accessToken: string | null;
  accountResponse: GetAccountResponse | null;
}): AccountAuthDecision {
  const hasAuthenticatedIdentity =
    params.isAuthenticated || params.accessToken != null;
  if (!hasAuthenticatedIdentity) return { type: "email-hint" };
  if (!params.accessToken || !params.accountResponse) return { type: "error" };
  if (params.accountResponse.nextAction === "create_account") {
    return { type: "create-account" };
  }
  return { type: "existing-account", response: params.accountResponse };
}

function isAccountAuthChallengeEntryType(
  type: NavEntry["type"],
): type is AccountAuthChallengeEntryType {
  return ACCOUNT_AUTH_CHALLENGE_ENTRY_TYPES.has(
    type as AccountAuthChallengeEntryType,
  );
}

function isAccountAuthEntryType(
  type: NavEntry["type"],
): type is AccountAuthEntryType {
  return ACCOUNT_AUTH_ENTRY_TYPES.has(type as AccountAuthEntryType);
}

export function pruneCompletedAccountAuth(
  stack: NavEntry[],
  nextType: NavEntry["type"],
) {
  if (isAccountAuthChallengeEntryType(nextType)) return stack;
  return stack.filter((entry) => !isAccountAuthEntryType(entry.type));
}
