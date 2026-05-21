import type { NavNodeCashApp, NavNodeExchange } from "../api/navTree.js";

import { t } from "../hooks/locale.js";
import { isDesktop, type DaimoPlatform } from "../platform.js";
import { ExternalPaymentPage } from "./ExternalPaymentPage.js";

type ExchangePageProps = {
  node: NavNodeExchange | NavNodeCashApp;
  platform: DaimoPlatform;
  exchangeUrl?: string;
  waitingMessage?: string;
  expiresAt?: number;
  isLoading?: boolean;
  onBack: () => void;
  onRetry?: () => void;
  baseUrl: string;
};

export function ExchangePage({
  node,
  platform,
  exchangeUrl,
  waitingMessage,
  isLoading,
  onBack,
  baseUrl,
}: ExchangePageProps) {
  const exchangeId = node.type === "CashApp" ? "CashApp" : node.exchangeId;
  const desktopBehavior =
    exchangeId === "Coinbase" || exchangeId === "MtPelerin" ? "popup" : "qr";
  const usesDesktopQR = isDesktop(platform) && desktopBehavior === "qr";

  const placeholderDensity =
    exchangeId === "Binance" ? ("medium" as const) : ("short" as const);

  return (
    <ExternalPaymentPage
      title={node.title}
      platform={platform}
      url={exchangeUrl}
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
      popupName={exchangeId.toLowerCase()}
      placeholderDensity={placeholderDensity}
    />
  );
}
