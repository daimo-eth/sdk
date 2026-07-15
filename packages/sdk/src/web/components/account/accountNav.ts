import type {
  AccountDepositStatus,
  DepositPaymentInfo,
  DepositPaymentInteraction,
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
 * Pick the modal entry page from the server-advertised interaction.
 * Wallet pay keeps its combined amount+widget screen; every other interaction
 * starts with generic amount entry.
 */
export function getAccountPaymentEntryTarget(
  interaction: DepositPaymentInteraction,
) {
  switch (interaction) {
    case "wallet-pay-widget":
      return "account-wallet-pay" as const;
    case "bank-picker":
    case "bank-transfer":
    case "directions":
      return "account-amount" as const;
  }
}

/**
 * Pick the modal renderer for an interaction after amount entry.
 */
export function getAccountPaymentAdvanceTarget(
  interaction: DepositPaymentInteraction,
  platform: DaimoPlatform,
) {
  switch (interaction) {
    case "bank-picker":
      // JS-driven bank deeplinks (form-post popups, window.open) are
      // unreliable on mobile — skip the picker, then review before opening.
      return isDesktop(platform)
        ? ("account-institution-picker" as const)
        : ("account-institution-review" as const);
    case "bank-transfer":
    case "directions":
      return "account-payment-instructions" as const;
    case "wallet-pay-widget":
      return "account-wallet-pay" as const;
  }
}

/** Fail closed when server-advertised intent and actual instructions diverge. */
export function isPaymentInteractionCompatible(
  interaction: DepositPaymentInteraction,
  payment: DepositPaymentInfo,
): boolean {
  return interaction === payment.flow;
}
