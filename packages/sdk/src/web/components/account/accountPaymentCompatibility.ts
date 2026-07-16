import type {
  DepositDeeplink,
  DepositInstitutionPaymentUi,
  DepositPaymentInfo,
  DepositPaymentInteraction,
} from "../../../common/account.js";
import type { NavNodeFiat } from "../../api/navTree.js";
import { t } from "../../hooks/locale.js";

type BankPickerPayment = Pick<
  Extract<DepositPaymentInfo, { flow: "bank-picker" }>,
  "flow" | "currency" | "qrUrl" | "institutionPaymentUi" | "fallbackDeeplink"
>;

export type RequestToPayPayment = Extract<
  DepositPaymentInfo,
  { flow: "request-to-pay" }
>;

/**
 * Temporary old-server compatibility boundary. The normal path reads the
 * interaction from the nav node; only legacy nodes fall back to public rail.
 */
export function getNodePaymentInteraction(
  node: NavNodeFiat,
): DepositPaymentInteraction {
  if (node.paymentInteraction) return node.paymentInteraction;

  switch (node.fiatMethod) {
    case "interac":
      return "bank-picker";
    case "apple_pay":
      return "wallet-pay-widget";
    case "ach":
    case "sepa":
    case "ars":
      return "bank-transfer";
    case "jpyc":
      return "directions";
  }
}

/** Normalize additive institution UI fields, including old-server payloads. */
export function getInstitutionPaymentContract(
  payment: BankPickerPayment,
  depositAmount: string,
): {
  ui: DepositInstitutionPaymentUi;
  fallbackDeeplink: DepositDeeplink | null;
} {
  if (payment.institutionPaymentUi) {
    return {
      ui: payment.institutionPaymentUi,
      fallbackDeeplink:
        payment.fallbackDeeplink ??
        (payment.qrUrl ? { type: "redirect", url: payment.qrUrl } : null),
    };
  }

  const amount = `${payment.currency.symbol}${depositAmount} ${payment.currency.code}`;
  const reference = getLegacyRequestReference(payment.qrUrl);
  return {
    ui: {
      picker: {
        title: t.accountSelectBank,
        searchPlaceholder: t.accountSearchInstitutions,
        otherInstitutionsLabel: t.accountOtherInstitutions,
      },
      review: {
        title: t.accountInteracConfirmTitle,
        description: t.accountInteracConfirmDesc,
        fields: [
          {
            key: "amount",
            label: t.accountInteracConfirmAmount,
            value: amount,
          },
          {
            key: "sender",
            label: t.accountInteracConfirmSender,
            value: "PayTrie AB Inc",
          },
          ...(reference
            ? [
                {
                  key: "reference",
                  label: t.accountInteracConfirmReference,
                  value: reference,
                },
              ]
            : []),
        ],
        institutionLabel: t.accountInteracConfirmBank,
        openInstitutionLabel: t.open,
        openFallbackLabel: t.accountInteracConfirmOpenInterac,
      },
      waiting: {
        title: t.accountBankTransfer,
        instructions: t.accountInteracWaitingInstructions(amount),
        openInstitutionLabel: t.open,
        openFallbackLabel: t.accountInteracConfirmOpenInterac,
      },
    },
    fallbackDeeplink: payment.qrUrl
      ? { type: "redirect", url: payment.qrUrl }
      : null,
  };
}

/** Validate every required request-to-pay field before rendering or signing. */
export function getRequestToPayContract(
  payment: DepositPaymentInfo,
): RequestToPayPayment | null {
  if (payment.flow !== "request-to-pay") return null;
  if (!isNonEmptyString(payment.paymentCode)) return null;
  if (!isPositiveDecimal(payment.payableAmount)) return null;
  if (!isPositiveDecimal(payment.expectedSettlementAmount)) return null;
  if (!isNonEmptyString(payment.instructions)) return null;
  if (!Number.isSafeInteger(payment.expiresAt) || payment.expiresAt <= 0) {
    return null;
  }
  if (!isNonEmptyString(payment.currency?.code)) return null;
  if (!isNonEmptyString(payment.currency?.symbol)) return null;
  if (!isNonEmptyString(payment.destinationToken?.symbol)) return null;
  if (payment.retry?.type !== "recreate-session") return null;

  const ui = payment.ui;
  if (!ui || typeof ui !== "object") return null;
  if (
    ![
      ui.title,
      ui.codeLabel,
      ui.actionLabel,
      ui.actionCompletedLabel,
      ui.expiredTitle,
      ui.expiredInstructions,
      ui.retryLabel,
      ui.retryingLabel,
    ].every(isNonEmptyString)
  ) {
    return null;
  }

  return payment;
}

/** Select the token-units amount covered by the routing authorization. */
export function getAuthorizedRoutingAmount(
  payment: DepositPaymentInfo,
  depositAmount: string,
): string {
  switch (payment.flow) {
    case "request-to-pay": {
      const contract = getRequestToPayContract(payment);
      if (!contract) throw new Error("invalid request-to-pay payment info");
      return contract.expectedSettlementAmount;
    }
    case "wallet-pay-widget":
      return payment.purchaseAmount;
    case "bank-picker":
    case "bank-transfer":
    case "directions":
      return depositAmount;
  }
}

/** True only for a valid request whose absolute server expiry has passed. */
export function isExpiredRequestToPay(
  payment: DepositPaymentInfo,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const contract = getRequestToPayContract(payment);
  return contract != null && contract.expiresAt <= nowSeconds;
}

function getLegacyRequestReference(qrUrl: string | null): string | null {
  if (!qrUrl) return null;
  try {
    const url = new URL(qrUrl, "https://payment.invalid");
    const reference = url.searchParams.get("rID");
    return reference && reference.length > 0 ? reference : null;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveDecimal(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return false;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}
