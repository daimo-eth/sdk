import type { AccountRail } from "../../../common/account.js";

/**
 * Fiat rails that must run in a top-level daimo.com window when the checkout
 * is framed. Apple Pay merchant validation checks the top-level domain, so
 * it cannot run inside an iframe on a partner site.
 */
const FIAT_POPUP_RAILS: ReadonlySet<AccountRail> = new Set(["apple_pay"]);

export const FIAT_POPUP_WINDOW_NAME = "daimo-pay-popup";

export const FIAT_POPUP_FEATURES = "popup=yes,width=420,height=760";

export function railRequiresPopup(rail: AccountRail): boolean {
  return FIAT_POPUP_RAILS.has(rail);
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
