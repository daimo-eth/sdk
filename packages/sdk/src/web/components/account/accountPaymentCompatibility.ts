import type {
  DepositDeeplink,
  DepositInstitutionPaymentUi,
  DepositPaymentInfo,
  DepositPaymentInteraction,
  DepositPreCreatePaymentInput,
} from "../../../common/account.js";
import type { NavNodeFiat } from "../../api/navTree.js";
import { t } from "../../hooks/locale.js";

type BankPickerPayment = Pick<
  Extract<DepositPaymentInfo, { flow: "bank-picker" }>,
  "flow" | "currency" | "qrUrl" | "institutionPaymentUi" | "fallbackDeeplink"
>;

const INTERAC_PROCESSING_TIME = "5–30 min";

export type RequestToPayPayment = Extract<
  DepositPaymentInfo,
  { flow: "request-to-pay" }
>;

export type InstitutionPickerPayment = Extract<
  DepositPaymentInfo,
  { flow: "institution-picker" }
>;

export type ApprovalPayment = Extract<
  DepositPaymentInfo,
  { flow: "hosted-approval" | "external-app-approval" }
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
    default:
      throw new Error("payment interaction unavailable");
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
            key: "sender",
            label: t.accountInteracConfirmSender,
            value: "PayTrie AB Inc",
          },
          {
            key: "amount",
            label: t.accountInteracConfirmAmount,
            value: amount,
          },
        ],
        institutionLabel: t.accountInteracConfirmBank,
        fieldsAfterInstitution: [
          {
            key: "processing_time",
            label: t.accountInteracConfirmProcessingTime,
            value: INTERAC_PROCESSING_TIME,
          },
        ],
        openInstitutionLabel: t.open,
        openFallbackLabel: t.accountInteracConfirmOpenInterac,
      },
      waiting: {
        title: t.accountBankTransfer,
        instructions: t.accountInteracWaitingInstructions(
          amount,
          INTERAC_PROCESSING_TIME,
        ),
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

/** Validate one exact pre-create institution catalog before rendering. */
export function getInstitutionPickerContract(
  payment: DepositPaymentInfo,
): InstitutionPickerPayment | null {
  if (payment.flow !== "institution-picker") return null;
  if (!isPositiveDecimal(payment.payableAmount)) return null;
  if (!isPositiveDecimal(payment.expectedSettlementAmount)) return null;
  if (!isNonEmptyString(payment.instructions)) return null;
  if (!isNonEmptyString(payment.currency?.code)) return null;
  if (!isNonEmptyString(payment.currency?.symbol)) return null;
  if (!isNonEmptyString(payment.destinationToken?.symbol)) return null;
  if (!isInstitutionPickerUi(payment.ui)) return null;

  const { action } = payment;
  if (
    !action ||
    action.inputKind !== "institution" ||
    !isNonEmptyString(action.id) ||
    !isNonEmptyString(action.revision) ||
    !isNonEmptyString(action.catalogRevision)
  ) {
    return null;
  }

  if (payment.institutions.length === 0) return null;
  const ids = new Set<string>();
  for (const institution of payment.institutions) {
    if (
      !isNonEmptyString(institution.id) ||
      !isNonEmptyString(institution.name) ||
      ids.has(institution.id)
    ) {
      return null;
    }
    ids.add(institution.id);
  }
  return payment;
}

/** Build the only typed client input accepted for an issued catalog action. */
export function buildInstitutionPaymentInput(
  payment: DepositPaymentInfo,
  institutionId: string,
): DepositPreCreatePaymentInput {
  const contract = getInstitutionPickerContract(payment);
  if (!contract) throw new Error("invalid institution-picker payment info");
  if (!contract.institutions.some((item) => item.id === institutionId)) {
    throw new Error("institution not in payment catalog");
  }
  return {
    kind: "institution",
    actionId: contract.action.id,
    revision: contract.action.revision,
    catalogRevision: contract.action.catalogRevision,
    institutionId,
  };
}

/** Validate hosted and passive external-app approval contracts. */
export function getApprovalContract(
  payment: DepositPaymentInfo,
): ApprovalPayment | null {
  if (
    payment.flow !== "hosted-approval" &&
    payment.flow !== "external-app-approval"
  ) {
    return null;
  }
  if (!isPositiveDecimal(payment.payableAmount)) return null;
  if (!isPositiveDecimal(payment.expectedSettlementAmount)) return null;
  if (!isNonEmptyString(payment.currency?.code)) return null;
  if (!isNonEmptyString(payment.currency?.symbol)) return null;
  if (!isNonEmptyString(payment.destinationToken?.symbol)) return null;
  if (!Number.isSafeInteger(payment.expiresAt) || payment.expiresAt <= 0) {
    return null;
  }
  if (
    payment.polling?.type !== "poll" ||
    !Number.isSafeInteger(payment.polling.delayMs) ||
    payment.polling.delayMs <= 0 ||
    payment.polling.delayMs > 60_000
  ) {
    return null;
  }
  if (payment.retry?.type !== "recreate-session") return null;

  if (payment.flow === "hosted-approval") {
    if (!isHttpsUrl(payment.approvalUrl)) return null;
    if (payment.returnBehavior?.type !== "poll") return null;
    if (payment.reopen?.type !== "same-url") return null;
    if (
      ![
        payment.ui?.title,
        payment.ui?.instructions,
        payment.ui?.openLabel,
        payment.ui?.reopenLabel,
        payment.ui?.expiredTitle,
        payment.ui?.expiredInstructions,
        payment.ui?.retryLabel,
        payment.ui?.retryingLabel,
      ].every(isNonEmptyString)
    ) {
      return null;
    }
    return payment;
  }

  if (!isNonEmptyString(payment.maskedDestination)) return null;
  if (
    ![
      payment.ui?.title,
      payment.ui?.instructions,
      payment.ui?.destinationLabel,
      payment.ui?.expiredTitle,
      payment.ui?.expiredInstructions,
      payment.ui?.retryLabel,
      payment.ui?.retryingLabel,
    ].every(isNonEmptyString)
  ) {
    return null;
  }
  if (
    payment.action &&
    (payment.action.type !== "open-url" ||
      !isSafeExternalUrl(payment.action.url) ||
      !isNonEmptyString(payment.action.label))
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
    case "institution-picker": {
      const contract = getInstitutionPickerContract(payment);
      if (!contract) throw new Error("invalid institution-picker payment info");
      return contract.expectedSettlementAmount;
    }
    case "hosted-approval":
    case "external-app-approval": {
      const contract = getApprovalContract(payment);
      if (!contract) throw new Error("invalid approval payment info");
      return contract.expectedSettlementAmount;
    }
    case "bank-picker":
    case "bank-transfer":
    case "directions":
      return depositAmount;
  }
}

/** True only for a valid approval whose absolute server expiry has passed. */
export function isExpiredApproval(
  payment: DepositPaymentInfo,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const contract = getApprovalContract(payment);
  return contract != null && contract.expiresAt <= nowSeconds;
}

/** True only for a valid request whose absolute server expiry has passed. */
export function isExpiredRequestToPay(
  payment: DepositPaymentInfo,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const contract = getRequestToPayContract(payment);
  return contract != null && contract.expiresAt <= nowSeconds;
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

function isInstitutionPickerUi(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  const ui = value as Record<string, unknown>;
  return [ui.title, ui.searchPlaceholder, ui.otherInstitutionsLabel].every(
    isNonEmptyString,
  );
}

function isHttpsUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeExternalUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const protocol = new URL(value).protocol.toLowerCase();
    return !["data:", "file:", "javascript:", "vbscript:"].includes(protocol);
  } catch {
    return false;
  }
}
