import { useRef } from "react";

import type { NavNodeFiat } from "../../api/navTree.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { createNavLogger } from "../../hooks/navEvent.js";
import type { DaimoPlatform } from "../../platform.js";
import { HostedPaymentPage } from "../HostedPaymentPage.js";
import {
  buildFiatPopupUrl,
  FIAT_POPUP_FEATURES,
  FIAT_POPUP_WINDOW_NAME,
} from "./fiatPopup.js";

type FiatPopupPageProps = {
  node: NavNodeFiat;
  sessionId: string;
  clientSecret: string;
  platform: DaimoPlatform;
  baseUrl: string;
  onBack: (() => void) | null;
};

/**
 * Handoff shown when a fiat rail must run top-level (framed checkout).
 * Opens the checkout in a popup on the daimo origin, where Apple Pay
 * merchant validation and account login run first-party. This page never
 * creates a deposit; completion arrives via session polling, which swaps
 * the embed to the terminal success page.
 */
export function FiatPopupPage({
  node,
  sessionId,
  clientSecret,
  platform,
  baseUrl,
  onBack,
}: FiatPopupPageProps) {
  const client = useDaimoClient();
  const logNavEvent = createNavLogger(client);
  const openedRef = useRef(false);

  const url =
    typeof window === "undefined"
      ? undefined
      : buildFiatPopupUrl(window.location.href, node.id);

  const handleOpened = (popup: Window | null) => {
    if (!popup) {
      logNavEvent(sessionId, clientSecret, {
        nodeId: node.id,
        nodeType: node.type,
        action: "popup_blocked",
      });
      return;
    }
    popup.focus();
    logNavEvent(sessionId, clientSecret, {
      nodeId: node.id,
      nodeType: node.type,
      action: "popup_open",
      reopen: openedRef.current,
    });
    openedRef.current = true;
  };

  return (
    <HostedPaymentPage
      title={node.title}
      platform={platform}
      url={url}
      icon={node.icon}
      message={`${t.continueTo} ${node.title} ${t.toCompleteYourDeposit}`}
      onBack={onBack}
      baseUrl={baseUrl}
      desktopBehavior="popup"
      popupName={FIAT_POPUP_WINDOW_NAME}
      popupFeatures={FIAT_POPUP_FEATURES}
      onOpened={handleOpened}
    />
  );
}
