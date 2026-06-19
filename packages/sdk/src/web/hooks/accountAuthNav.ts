import type { NavEntry } from "./types.js";

type AccountAuthChallengeEntryType = Extract<
  NavEntry["type"],
  "account-otp" | "account-phone-otp" | "account-ripio-otp"
>;
type AccountAuthEntryType = Extract<
  NavEntry["type"],
  | "account-email"
  | "account-otp"
  | "account-phone"
  | "account-phone-otp"
  | "account-ripio-otp"
>;

const ACCOUNT_AUTH_CHALLENGE_ENTRY_TYPES =
  new Set<AccountAuthChallengeEntryType>([
    "account-otp",
    "account-phone-otp",
    "account-ripio-otp",
  ]);

const ACCOUNT_AUTH_ENTRY_TYPES = new Set<AccountAuthEntryType>([
  "account-email",
  "account-otp",
  "account-phone",
  "account-phone-otp",
  "account-ripio-otp",
]);

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
