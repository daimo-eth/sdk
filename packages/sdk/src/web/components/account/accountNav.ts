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
  interaction?: DepositPaymentInteraction,
): "account-status" | null {
  switch (status) {
    case "payment_received":
    case "token_delivered":
    case "completed":
    case "failed":
      return "account-status";
    case "expired":
      return interaction != null &&
        shouldRecoverExpiredPayment(status, interaction)
        ? null
        : "account-status";
    case "initiated":
    case "awaiting_payment":
      return null;
  }
}

/** Expired interactive requests recover on their own semantic surface. */
export function shouldRecoverExpiredPayment(
  status: AccountDepositStatus,
  interaction: DepositPaymentInteraction,
): boolean {
  if (status !== "expired") return false;
  return (
    interaction === "request-to-pay" ||
    interaction === "institution-picker" ||
    interaction === "hosted-approval" ||
    interaction === "external-app-approval"
  );
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
    case "external-app-approval":
    case "hosted-approval":
    case "institution-picker":
    case "request-to-pay":
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
    case "institution-picker":
      return "account-institution-picker" as const;
    case "bank-picker":
      // JS-driven bank deeplinks (form-post popups, window.open) are
      // unreliable on mobile — skip the picker, then review before opening.
      return isDesktop(platform)
        ? ("account-institution-picker" as const)
        : ("account-institution-review" as const);
    case "bank-transfer":
    case "directions":
      return "account-payment-instructions" as const;
    case "request-to-pay":
      return "account-request-to-pay" as const;
    case "hosted-approval":
    case "external-app-approval":
      return "account-approval" as const;
    case "wallet-pay-widget":
      return "account-wallet-pay" as const;
  }
}

/** Advance after institution selection without re-entering the legacy picker. */
export function getInstitutionSelectionAdvanceTarget(
  paymentFlow: DepositPaymentInteraction,
  platform: DaimoPlatform,
) {
  if (paymentFlow === "bank-picker") {
    return "account-institution-review" as const;
  }
  return getAccountPaymentAdvanceTarget(paymentFlow, platform);
}

/** Fail closed when server-advertised intent and actual instructions diverge. */
export function isPaymentInteractionCompatible(
  interaction: DepositPaymentInteraction,
  payment: DepositPaymentInfo,
): boolean {
  return interaction === payment.flow;
}
