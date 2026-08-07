import type { WalletPaymentOption } from "./api/walletTypes.js";

/** Convert a selected wallet USD amount to an exact, balance-capped raw amount. */
export function getWalletTokenAmount(
  option: WalletPaymentOption,
  amountUsd: number,
): bigint {
  const tokenBalance = BigInt(option.balance.amount);
  if (option.required.usd > 0) return BigInt(option.required.amount);

  const balanceUsd = option.balance.usd;
  if (balanceUsd <= 0) throw new Error("balance must be positive");

  const rawTokenAmount =
    (tokenBalance * BigInt(Math.floor(amountUsd * 1e6))) /
    BigInt(Math.floor(balanceUsd * 1e6));
  return rawTokenAmount > tokenBalance ? tokenBalance : rawTokenAmount;
}
