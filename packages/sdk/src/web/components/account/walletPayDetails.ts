import type { DepositLimit } from "../../../common/account.js";
import { formatFixedAmount } from "../../formatAmount.js";

const MAX_DISPLAYED_PURCHASES_REMAINING = 99;

export type WalletPayLimitDetails = {
  weeklyRemaining: string | null;
  depositCountRemaining: string | null;
};

/** Provider-agnostic values for the wallet-pay limits summary. */
export function getWalletPayLimitDetails(
  limits: DepositLimit[] | undefined,
  fallbackCurrencySymbol: string,
): WalletPayLimitDetails {
  if (!limits?.length) {
    return { weeklyRemaining: null, depositCountRemaining: null };
  }

  const weekly =
    limits.find((limit) => limit.unit === "fiat" && limit.period === "week") ??
    limits.find((limit) => limit.unit === "fiat");
  const purchases =
    limits.find(
      (limit) => limit.unit === "count" && limit.period === "lifetime",
    ) ?? limits.find((limit) => limit.unit === "count");

  return {
    weeklyRemaining: weekly
      ? formatWeeklyLimit(weekly, fallbackCurrencySymbol)
      : null,
    depositCountRemaining: purchases ? formatPurchaseLimit(purchases) : null,
  };
}

function formatWeeklyLimit(
  limit: DepositLimit,
  fallbackCurrencySymbol: string,
): string | null {
  if (limit.remaining == null) return "Unlimited";
  const remaining = parseLimitNumber(limit.remaining);
  if (remaining == null) return null;
  const symbol = limit.currency?.symbol ?? fallbackCurrencySymbol;
  return `${symbol}${formatLimitNumber(remaining)}`;
}

function formatPurchaseLimit(limit: DepositLimit): string | null {
  if (limit.remaining == null) return "Unlimited deposits";
  const remaining = parseLimitNumber(limit.remaining);
  if (remaining == null) return null;
  const count = Math.max(0, Math.floor(remaining));
  if (count > MAX_DISPLAYED_PURCHASES_REMAINING) {
    return `${MAX_DISPLAYED_PURCHASES_REMAINING + 1}+ deposits`;
  }
  return `${count} ${count === 1 ? "deposit" : "deposits"}`;
}

function parseLimitNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLimitNumber(value: number): string {
  return formatFixedAmount(value, Number.isInteger(value) ? 0 : 2);
}
