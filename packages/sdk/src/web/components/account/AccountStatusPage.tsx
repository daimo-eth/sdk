import { useCallback, useState } from "react";

import type {
  AccountDepositEta,
  AccountDepositStatus,
  AccountRail,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { ConfirmationSpinner } from "../ConfirmationSpinner.js";
import { ErrorPage } from "../ErrorPage.js";
import { CenteredContent, PageHeader, ShowReceiptButton } from "../shared.js";
import { AccountPixExpiredContent } from "./AccountPixExpiredContent.js";
import { shouldShowPixExpiredRecovery } from "./accountPixExpired.js";

type AccountStatusPageProps = {
  sessionId: string;
  clientSecret: string;
  baseUrl: string;
  rail: AccountRail;
  /** Known deposit status on mount (resume); avoids a wrong first paint. */
  initialStatus?: AccountDepositStatus;
  /** Known deposit amount on mount; keeps recovery actions immediately ready. */
  initialFiatAmount?: string;
  onPixRetry?: (depositAmount: string) => Promise<void>;
};

const TERMINAL_STATUSES: AccountDepositStatus[] = [
  "completed",
  "failed",
  "expired",
];

function getStatusLabel(status: AccountDepositStatus): string {
  switch (status) {
    case "payment_received":
      return t.depositDetected;
    case "token_delivered":
      return t.depositFinalizing;
    case "completed":
      return t.depositFinalizing;
    default:
      return t.depositDetected;
  }
}

/** Account deposit confirmation with spinner-led progress and account actions. */
export function AccountStatusPage({
  sessionId,
  clientSecret,
  baseUrl,
  rail,
  initialStatus,
  initialFiatAmount,
  onPixRetry,
}: AccountStatusPageProps) {
  const client = useDaimoClient();
  const [status, setStatus] = useState<AccountDepositStatus>(
    initialStatus ?? "payment_received",
  );
  const [eta, setEta] = useState<AccountDepositEta | null>(null);
  const [fiatAmount, setFiatAmount] = useState<string | null>(
    initialFiatAmount ?? null,
  );
  const [isRetrying, setIsRetrying] = useState(false);

  useDepositPoller({
    client,
    sessionId,
    clientSecret,
    onUpdate: (deposit) => {
      setStatus(deposit.status);
      setEta(deposit.eta);
      setFiatAmount(deposit.fiatAmount);
    },
    shouldStop: (deposit) => TERMINAL_STATUSES.includes(deposit.status),
  });

  const handlePixRetry = useCallback(async () => {
    if (!fiatAmount || !onPixRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await onPixRetry(fiatAmount);
    } finally {
      setIsRetrying(false);
    }
  }, [fiatAmount, isRetrying, onPixRetry]);

  const isComplete = status === "completed";

  if (shouldShowPixExpiredRecovery(status, rail)) {
    return (
      <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
        <PageHeader title={t.expired} />
        <CenteredContent>
          <AccountPixExpiredContent
            sessionId={sessionId}
            onRetry={handlePixRetry}
            isRetrying={isRetrying || fiatAmount == null}
          />
        </CenteredContent>
      </div>
    );
  }

  if (status === "failed" || status === "expired") {
    return (
      <ErrorPage
        message={t.errorDepositFailed}
        sessionId={sessionId}
        hideRetry
      />
    );
  }

  const title = isComplete
    ? t.accountDepositComplete
    : t.accountDepositReceived;
  const statusLabel = getStatusLabel(status);
  const displayEta = eta ? getStatusEta(status, eta) : null;

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title} />

      <CenteredContent>
        <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-5">
          <ConfirmationSpinner done={isComplete} />
          {!isComplete && <StatusLine label={statusLabel} eta={displayEta} />}
        </div>
      </CenteredContent>

      <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-2 daimo-px-6 daimo-pb-6">
        <ShowReceiptButton sessionId={sessionId} baseUrl={baseUrl} />
      </div>
    </div>
  );
}

function getStatusEta(
  status: AccountDepositStatus,
  eta: AccountDepositEta,
): string {
  if (status === "token_delivered") return eta.finalizing;
  return eta.payment;
}

function StatusLine({ label, eta }: { label: string; eta: string | null }) {
  return (
    <div
      className="daimo-flex daimo-min-h-[36px] daimo-w-full daimo-max-w-xs daimo-items-center daimo-justify-center daimo-gap-2 daimo-rounded-full daimo-px-4 daimo-py-2 daimo-text-sm daimo-font-medium"
      style={{
        backgroundColor: "var(--daimo-surface-secondary)",
        color: "var(--daimo-text-secondary)",
      }}
    >
      <span>{label}</span>
      {eta && (
        <>
          <span
            className="daimo-h-1 daimo-w-1 daimo-rounded-full"
            style={{ backgroundColor: "var(--daimo-text-muted)" }}
          />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>ETA {eta}</span>
        </>
      )}
    </div>
  );
}
