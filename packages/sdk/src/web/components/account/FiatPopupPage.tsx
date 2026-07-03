import { useState } from "react";

import type { NavNodeFiat } from "../../api/navTree.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { createNavLogger } from "../../hooks/navEvent.js";
import { PrimaryButton } from "../buttons.js";
import { ConfirmationSpinner } from "../ConfirmationSpinner.js";
import { ExternalLinkIcon } from "../icons.js";
import { CenteredContent, PageHeader, PageLogo } from "../shared.js";
import { buildFiatPopupUrl, openFiatPopup } from "./fiatPopup.js";

type FiatPopupPageProps = {
  node: NavNodeFiat;
  sessionId: string;
  clientSecret: string;
  baseUrl: string;
  onBack: (() => void) | null;
};

type PopupState = "idle" | "opened" | "blocked";

/**
 * Launcher shown when a fiat rail must run top-level (cross-origin embed).
 * Opens the checkout in a popup on the daimo origin, where Apple Pay
 * merchant validation and account login run first-party. This page never
 * creates a deposit; completion arrives via session polling, which swaps
 * the embed to the terminal success page.
 */
export function FiatPopupPage({
  node,
  sessionId,
  clientSecret,
  baseUrl,
  onBack,
}: FiatPopupPageProps) {
  const client = useDaimoClient();
  const logNavEvent = createNavLogger(client);
  const [popupState, setPopupState] = useState<PopupState>("idle");

  // Must stay synchronous: window.open outside the click gesture is blocked.
  const handleOpen = () => {
    const url = buildFiatPopupUrl(window.location.href, node.id);
    const popup = openFiatPopup(url);
    if (!popup) {
      setPopupState("blocked");
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
      reopen: popupState === "opened",
    });
    setPopupState("opened");
  };

  const waiting = popupState === "opened";

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader
        title={waiting ? t.popupWaitingTitle : node.title}
        onBack={onBack}
      />
      <CenteredContent>
        <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-6 daimo-py-8">
          {waiting ? (
            <ConfirmationSpinner done={false} size={80} />
          ) : (
            node.icon && (
              <PageLogo icon={node.icon} alt={node.title} baseUrl={baseUrl} />
            )
          )}
          <p className="daimo-text-center daimo-text-[var(--daimo-text-secondary)] daimo-px-6">
            {waiting ? t.popupWaitingBody : t.popupLaunchBody}
          </p>
          {popupState === "blocked" && (
            <p className="daimo-text-center daimo-text-[var(--daimo-error)] daimo-px-6">
              {t.popupBlocked}
            </p>
          )}
          <PrimaryButton onClick={handleOpen} icon={<ExternalLinkIcon />}>
            {waiting ? t.popupReopenWindow : t.popupContinueWith(node.title)}
          </PrimaryButton>
        </div>
      </CenteredContent>
    </div>
  );
}
