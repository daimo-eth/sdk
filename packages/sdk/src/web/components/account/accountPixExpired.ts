import type {
  AccountDepositStatus,
  AccountRail,
} from "../../../common/account.js";

/** PIX-only expired deposits get session recreation instead of a dead-end error. */
export function shouldShowPixExpiredRecovery(
  status: AccountDepositStatus,
  rail: AccountRail,
): boolean {
  return status === "expired" && rail === "pix";
}
