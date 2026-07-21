import type {
  AccountRail,
  DepositPaymentInfo,
} from "../../../common/account.js";

type WalletPayKind = Extract<
  DepositPaymentInfo,
  { flow: "wallet-pay-widget" }
>["paymentLinkKind"];

/** Keep wallet-pay copy stable while its payment details are loading. */
export function getWalletPayName(
  rail: AccountRail,
  paymentLinkKind: WalletPayKind | null,
): string {
  switch (paymentLinkKind) {
    case "apple_pay":
      return "Apple Pay";
    case "google_pay":
      return "Google Pay";
    case null:
      return rail === "apple_pay" ? "Apple Pay" : "Wallet Pay";
  }
}
