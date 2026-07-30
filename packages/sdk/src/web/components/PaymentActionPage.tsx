import type { PaymentAction } from "../../common/api.js";
import {
  formatNavSourceAmountUnits,
  getNavExternalHandoff,
  getNavSourceAmount,
  type NavActionPaymentMethodNode,
} from "../api/navTree.js";

import { t } from "../hooks/locale.js";
import { isDesktop, type DaimoPlatform } from "../platform.js";
import { HostedPaymentPage } from "./HostedPaymentPage.js";

type PaymentActionPageProps = {
  node: NavActionPaymentMethodNode;
  platform: DaimoPlatform;
  sourceAmount: number;
  action?: PaymentAction;
  isLoading?: boolean;
  onBack: () => void;
  baseUrl: string;
};

export function PaymentActionPage({
  node,
  platform,
  sourceAmount,
  action,
  isLoading,
  onBack,
  baseUrl,
}: PaymentActionPageProps) {
  const openUrl = action?.type === "openUrl" ? action : undefined;
  const embeddedWidget = action?.type === "embeddedWidget" ? action : undefined;
  const presentation = openUrl?.presentation ?? "popup";
  const usesDesktopQR = isDesktop(platform) && presentation === "qr";
  const url = openUrl?.url ?? embeddedWidget?.fallbackUrl;
  const sourcePolicy = getNavSourceAmount(node);
  const sourceUnits = formatNavSourceAmountUnits(sourceAmount, sourcePolicy);
  const formattedSourceAmount = `${sourcePolicy.currencySymbol}${sourceUnits} ${sourcePolicy.currency}`;
  const placeholderDensity =
    node.type === "Exchange" || node.type === "CashApp"
      ? getNavExternalHandoff(node).legacyQrPlaceholderDensity
      : undefined;

  return (
    <HostedPaymentPage
      title={node.title}
      platform={platform}
      url={url}
      icon={node.icon}
      message={
        openUrl?.waitingMessage ??
        (embeddedWidget
          ? t.depositExactlyWith(formattedSourceAmount, node.title)
          : usesDesktopQR
            ? t.scanWithPhone
            : `${t.continueTo} ${node.title} ${t.toCompleteYourDeposit}`)
      }
      isLoading={isLoading}
      onBack={onBack}
      baseUrl={baseUrl}
      desktopBehavior={presentation}
      placeholderDensity={placeholderDensity}
      popupName={
        openUrl?.popupName ?? embeddedWidget?.sdk ?? node.id.toLowerCase()
      }
      details={
        openUrl?.quote == null
          ? undefined
          : [
              {
                id: "estimated-output",
                label: t.estimatedOutput,
                value: `${openUrl.quote.estimatedDestinationAmount.units} ${openUrl.quote.estimatedDestinationAmount.currency}`,
              },
              ...openUrl.quote.fees.map((fee, index) => ({
                id: `fee-${fee.kind}-${index}`,
                label:
                  fee.kind === "service"
                    ? t.serviceFee
                    : fee.kind === "network"
                      ? t.networkFee
                      : t.partnerFee,
                value: `${fee.amount.units} ${fee.amount.currency}`,
              })),
            ]
      }
    />
  );
}
