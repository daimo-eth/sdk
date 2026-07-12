import type {
  AccountDepositStatus,
  AccountRail,
} from "../../../common/account.js";
import { isDesktop, type DaimoPlatform } from "../../platform.js";

/**
 * Pick the modal page to resume at for a session with an existing deposit.
 * Once payment is past the provider (or terminal), the status page owns the
 * UX; earlier states re-enter the normal payment flow.
 */
export function getDepositResumeTarget(
  status: AccountDepositStatus,
): "account-status" | null {
  switch (status) {
    case "payment_received":
    case "token_delivered":
    case "completed":
    case "failed":
    case "expired":
      return "account-status";
    case "initiated":
    case "awaiting_payment":
      return null;
  }
}

/**
 * Pick the modal entry page for a rail. Each rail has its own payment UX:
 * - interac: two-step amount entry → bank picker (desktop) or deeplink (mobile)
 * - ach/sepa/jpyc/ars: two-step amount entry → transfer details
 * - apple_pay: single unified amount+Apple Pay page (Coinbase Headless)
 */
export function getAccountPaymentEntryTarget(rail: AccountRail) {
  switch (rail) {
    case "apple_pay":
      // Coinbase Headless: amount input + Apple Pay live in the same page.
      return "account-apple-pay" as const;
    case "interac":
    case "ach":
    case "sepa":
    case "jpyc":
    case "ars":
    case "chf":
      // Old two-step flow: amount first, then picker/details.
      return "account-payment" as const;
  }
}

/**
 * Pick the modal page that follows the deposit amount screen (for rails
 * that use the two-step flow).
 */
export function getAccountPaymentAdvanceTarget(
  rail: AccountRail,
  platform: DaimoPlatform,
) {
  switch (rail) {
    case "interac":
      // JS-driven bank deeplinks (form-post popups, window.open) are
      // unreliable on mobile — skip the picker, then review before Interac.
      return isDesktop(platform)
        ? ("account-canada-bank-picker" as const)
        : ("account-interac-confirm" as const);
    case "ach":
    case "sepa":
    case "jpyc":
    case "ars":
    case "chf":
      return "account-bank-details" as const;
    case "apple_pay":
      // Never used — apple_pay skips account-payment entirely.
      return "account-apple-pay" as const;
  }
}
