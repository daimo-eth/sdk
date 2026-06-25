import type { NavNodeStripe } from "../api/navTree.js";
import { formatFixedAmount } from "../formatAmount.js";
import { t } from "../hooks/locale.js";
import type { DaimoPlatform } from "../platform.js";
import { ErrorPage } from "./ErrorPage.js";
import { ExternalPaymentPage } from "./ExternalPaymentPage.js";

type StripeOnrampPageProps = {
  node: NavNodeStripe;
  platform: DaimoPlatform;
  amountUsd: number;
  redirectUrl?: string;
  isLoading?: boolean;
  error?: string;
  onBack: () => void;
  onRetry?: () => void;
  baseUrl: string;
};

export function StripeOnrampPage({
  node,
  platform,
  amountUsd,
  redirectUrl,
  isLoading,
  error,
  onBack,
  onRetry,
  baseUrl,
}: StripeOnrampPageProps) {
  if (error) {
    return (
      <ErrorPage
        message={error}
        retryText={t.tryAgain}
        onRetry={onRetry ?? (() => window.location.reload())}
      />
    );
  }

  return (
    <ExternalPaymentPage
      title={node.title}
      platform={platform}
      url={redirectUrl}
      icon={node.icon}
      message={`Deposit exactly $${formatFixedAmount(amountUsd)} with Stripe, then return to this page.`}
      isLoading={isLoading}
      onBack={onBack}
      baseUrl={baseUrl}
      desktopBehavior="popup"
      popupName="stripe"
    />
  );
}
