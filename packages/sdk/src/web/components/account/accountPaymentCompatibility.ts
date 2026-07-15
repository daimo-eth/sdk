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
