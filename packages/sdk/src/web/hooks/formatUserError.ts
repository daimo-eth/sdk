import { DaimoRequestError } from "../../common/errors.js";

import { t } from "./locale.js";
import { prefixWalletError, WalletError } from "./walletError.js";

/** Known error patterns mapped to user-friendly messages */
function getErrorMappings(): [pattern: string | RegExp, message: string][] {
  return [
    [/^(failed to fetch|fetch failed)$/i, t.networkErrorOffline],
    [
      /guest_region_forbidden|guest onramp transactions are not allowed|region.*not supported|not supported in your region/i,
      t.applePayRegionUnsupported,
    ],
    [
      /\bus_phone_required\b|require.*us phone number/i,
      t.applePayUsPhoneRequired,
    ],
  ];
}

/** Convert error to user-friendly display message */
export function formatUserError(
  err: unknown,
  fallback = t.somethingWentWrong,
): string {
  // Wallet provider errors carry the wallet name; prefix the resolved message.
  const walletName = err instanceof WalletError ? err.walletName : null;

  let raw: string;
  if (err instanceof Error) {
    raw = err.message;
  } else if (err && typeof err === "object" && "message" in err) {
    raw = String((err as { message: unknown }).message);
  } else if (typeof err === "string") {
    raw = err;
  } else {
    raw = "";
  }

  for (const [pattern, message] of getErrorMappings()) {
    if (typeof pattern === "string" ? raw === pattern : pattern.test(raw)) {
      return prefixWalletError(walletName, message);
    }
  }

  if (err instanceof DaimoRequestError && err.type === "api_error") {
    return prefixWalletError(walletName, fallback);
  }

  return prefixWalletError(walletName, raw || fallback);
}
