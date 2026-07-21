import type { DepositPaymentInteraction } from "../../../common/account.js";

/**
 * Wallet-pay widgets must run in a top-level daimo.com window when checkout is
 * framed. Merchant validation checks the top-level domain, so the interaction
 * cannot run inside an iframe on a partner site.
 */
export const FIAT_POPUP_WINDOW_NAME = "daimo-pay-popup";

export const FIAT_POPUP_FEATURES = "popup=yes,width=420,height=760";

export function interactionRequiresPopup(
  interaction: DepositPaymentInteraction,
): boolean {
  switch (interaction) {
    case "wallet-pay-widget":
      return true;
    case "bank-picker":
    case "bank-transfer":
    case "directions":
    case "external-app-approval":
    case "hosted-approval":
    case "institution-picker":
    case "request-to-pay":
      return false;
  }
}

/**
 * True when running inside an iframe, regardless of parent origin.
 * Top-level surfaces (direct webview, miniapp, the popup itself) keep the
 * inline flow. Same-origin frames (daimo demo pages) pop out too — inline
 * would work there, but one consistent path is simpler and makes any
 * framed context a faithful popup test harness.
 */
export function isFramed(): boolean {
  if (typeof window === "undefined") return false;
  return window.self !== window.top;
}

/**
 * Build the top-level popup URL from the current webview URL, preserving
 * session, client secret, locale, and theme params.
 */
export function buildFiatPopupUrl(currentHref: string, nodeId: string): string {
  const url = new URL(currentHref);
  url.searchParams.set("layout", "center");
  url.searchParams.set("popup", "1");
  url.searchParams.set("nav", nodeId);
  return url.toString();
}
