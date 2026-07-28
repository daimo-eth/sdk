import type { ExternalPaymentQuote } from "../../common/api.js";
import { getNavExternalHandoff } from "../api/navTree.js";
import type { NavExternalPaymentNode } from "../api/navTree.js";

import { t } from "../hooks/locale.js";
import { isDesktop, type DaimoPlatform } from "../platform.js";
import { ExternalPaymentPage } from "./ExternalPaymentPage.js";

type ExternalPaymentFlowPageProps = {
  node: NavExternalPaymentNode;
  platform: DaimoPlatform;
  paymentUrl?: string;
  waitingMessage?: string;
  expiresAt?: number;
  quote?: ExternalPaymentQuote;
  isLoading?: boolean;
  onBack: () => void;
  onRetry?: () => void;
  baseUrl: string;
};

export function ExternalPaymentFlowPage({
  node,
  platform,
  paymentUrl,
  waitingMessage,
  quote,
  isLoading,
  onBack,
  baseUrl,
}: ExternalPaymentFlowPageProps) {
  const handoff = getNavExternalHandoff(node);
  const { desktopBehavior } = handoff;
  const usesDesktopQR = isDesktop(platform) && desktopBehavior === "qr";

  return (
    <ExternalPaymentPage
      title={node.title}
      platform={platform}
      url={paymentUrl}
      icon={node.icon}
      message={
        waitingMessage ||
        (usesDesktopQR
          ? t.scanWithPhone
          : `${t.continueTo} ${node.title} ${t.toCompleteYourDeposit}`)
      }
      isLoading={isLoading}
      onBack={onBack}
      baseUrl={baseUrl}
      desktopBehavior={desktopBehavior}
      popupName={handoff.popupName ?? node.id.toLowerCase()}
      placeholderDensity={handoff.legacyQrPlaceholderDensity}
      details={
        quote == null
          ? undefined
          : [
              {
                label: t.estimatedOutput,
                value: `${quote.estimatedDestinationUnits} ${quote.destinationCurrency}`,
              },
              ...quote.fees.map((fee) => ({
                label:
                  fee.kind === "service"
                    ? t.serviceFee
                    : fee.kind === "network"
                      ? t.networkFee
                      : t.partnerFee,
                value: `${fee.amountUnits} ${fee.currency}`,
              })),
            ]
      }
    />
  );
}
