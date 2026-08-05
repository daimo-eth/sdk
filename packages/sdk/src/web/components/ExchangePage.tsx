import type { NavNodeCashApp, NavNodeExchange } from "../api/navTree.js";
import type { WaitingInstruction } from "../../common/api.js";

import { t } from "../hooks/locale.js";
import { isDesktop, type DaimoPlatform } from "../platform.js";
import { ExternalPaymentPage } from "./ExternalPaymentPage.js";

type ExchangePageProps = {
  node: NavNodeExchange | NavNodeCashApp;
  platform: DaimoPlatform;
  exchangeUrl?: string;
  waitingMessage?: string;
  waitingInstructions?: WaitingInstruction[];
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
  waitingInstructions,
  isLoading,
  onBack,
  baseUrl,
}: ExchangePageProps) {
  const exchangeId = node.type === "CashApp" ? "CashApp" : node.exchangeId;
  const desktopBehavior =
    exchangeId === "Coinbase" ||
    exchangeId === "MtPelerin" ||
    exchangeId === "RevolutRamp"
      ? "popup"
      : "qr";
  const usesDesktopQR = isDesktop(platform) && desktopBehavior === "qr";

  const isBinanceExchange =
    exchangeId === "Binance" ||
    exchangeId === "BinanceUSDC" ||
    exchangeId === "BinanceUSDT";
  const placeholderDensity = isBinanceExchange
    ? ("medium" as const)
    : ("short" as const);

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
      instructions={waitingInstructions}
      isLoading={isLoading}
      onBack={onBack}
      baseUrl={baseUrl}
      desktopBehavior={desktopBehavior}
      popupName={exchangeId.toLowerCase()}
      placeholderDensity={placeholderDensity}
    />
  );
}
