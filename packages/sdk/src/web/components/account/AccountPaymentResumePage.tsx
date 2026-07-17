import { useEffect } from "react";

import type {
  AccountRail,
  DepositPaymentInfo,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import { useDraftDeposit } from "../../hooks/useDraftDeposit.js";
import { ErrorPage } from "../ErrorPage.js";
import { CenteredContent, PageHeader } from "../shared.js";
import { Skeleton } from "../Skeleton.js";

/** Reload actual payment info before choosing a semantic resume renderer. */
export function AccountPaymentResumePage({
  sessionId,
  rail,
  onReady,
}: {
  sessionId: string;
  rail: AccountRail;
  onReady: (payment: DepositPaymentInfo) => void;
}) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const depositAmount = depositState?.depositAmount ?? "";
  const { payment, error, retry } = useDraftDeposit({
    client,
    accountFlow,
    sessionId,
    rail,
    depositAmount,
    enabled: depositAmount !== "",
    draftMode: "plain",
  });
  const depositId =
    depositState?.kind === "drafted" ? depositState.depositId : null;

  useEffect(() => {
    if (!payment || !depositId) return;
    setDepositState({
      depositAmount,
      kind: "started",
      depositId,
      payment,
    });
    onReady(payment);
  }, [depositAmount, depositId, onReady, payment, setDepositState]);

  if (error) {
    return <ErrorPage message={error} retryText={t.tryAgain} onRetry={retry} />;
  }
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title={t.loading} />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-4">
          <Skeleton className="daimo-h-4 daimo-w-64" rounded="sm" />
          <Skeleton className="daimo-h-24 daimo-w-full" rounded="lg" />
          <Skeleton className="daimo-h-12 daimo-w-full" rounded="lg" />
        </div>
      </CenteredContent>
    </div>
  );
}
