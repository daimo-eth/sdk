import type { DepositPaymentInteraction } from "../../../common/account.js";
import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import type { DaimoPlatform } from "../../platform.js";
import { CenteredContent, PageHeader } from "../shared.js";
import { Skeleton, SkeletonText } from "../Skeleton.js";
import { AccountAmountContent } from "./AccountPaymentPage.js";

type AccountLoadingPageProps = {
  paymentInteraction: DepositPaymentInteraction;
  methodLabel: string;
  platform: DaimoPlatform;
  baseUrl: string;
  onBack: (() => void) | null;
};

/** Match the expected next page while resume and account readiness are checked. */
export function AccountLoadingPage({
  paymentInteraction,
  methodLabel,
  platform,
  baseUrl,
  onBack,
}: AccountLoadingPageProps) {
  const account = useAccountFlow();
  if (account?.isAuthenticated && paymentInteraction !== "wallet-pay-widget") {
    return (
      <AccountAmountContent
        constraints={null}
        platform={platform}
        baseUrl={baseUrl}
        onBack={onBack}
      />
    );
  }
  return (
    <div
      className="daimo-flex daimo-flex-1 daimo-min-h-0 daimo-flex-col"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title={methodLabel} onBack={onBack} />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-5">
          <SkeletonText lines={2} />
          <Skeleton className="daimo-h-12 daimo-w-full" />
          <Skeleton className="daimo-h-12 daimo-w-full" />
        </div>
      </CenteredContent>
    </div>
  );
}
