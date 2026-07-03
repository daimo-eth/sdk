import type { AccountRail } from "../../../common/account.js";

/**
 * Fiat rails that must run in a top-level daimo.com window when the checkout
 * is embedded cross-origin. Apple Pay merchant validation checks the
 * top-level domain, so it cannot run inside an iframe on a partner site.
 */
const FIAT_POPUP_RAILS: ReadonlySet<AccountRail> = new Set(["apple_pay"]);

export const FIAT_POPUP_WINDOW_NAME = "daimo-pay-popup";

const FIAT_POPUP_WIDTH = 420;
const FIAT_POPUP_HEIGHT = 760;

export function railRequiresPopup(rail: AccountRail): boolean {
  return FIAT_POPUP_RAILS.has(rail);
}

/**
 * True when running in an iframe whose top-level page is another origin.
 * Same-origin embeds and top-level surfaces (direct webview, miniapp) keep
 * the inline flow.
 */
export function isCrossOriginEmbed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.self === window.top) return false;
  try {
    return window.top!.location.origin !== window.location.origin;
  } catch {
    // Cross-origin access to window.top throws.
    return true;
  }
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

/**
 * Open the fiat popup. Must be called synchronously from a user-gesture
 * handler or the browser will block it. Returns null when blocked. Desktop
 * gets a centered window; mobile browsers ignore features and open a tab.
 */
export function openFiatPopup(url: string): Window | null {
  const left = Math.max(
    0,
    window.screenX + (window.outerWidth - FIAT_POPUP_WIDTH) / 2,
  );
  const top = Math.max(
    0,
    window.screenY + (window.outerHeight - FIAT_POPUP_HEIGHT) / 2,
  );
  const features = `popup=yes,width=${FIAT_POPUP_WIDTH},height=${FIAT_POPUP_HEIGHT},left=${Math.round(left)},top=${Math.round(top)}`;
  return window.open(url, FIAT_POPUP_WINDOW_NAME, features);
}
