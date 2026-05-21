import { useState } from "react";

import type {
  AccountDepositEta,
  AccountDepositStatus,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { ConfirmationSpinner } from "../ConfirmationSpinner.js";
import { ErrorPage } from "../ErrorPage.js";
import { CenteredContent, PageHeader, ShowReceiptButton } from "../shared.js";

type AccountStatusPageProps = {
  sessionId: string;
  clientSecret: string;
  baseUrl: string;
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
}: AccountStatusPageProps) {
  const client = useDaimoClient();
  const [status, setStatus] =
    useState<AccountDepositStatus>("payment_received");
  const [eta, setEta] = useState<AccountDepositEta | null>(null);

  useDepositPoller({
    client,
    sessionId,
    clientSecret,
    onUpdate: (deposit) => {
      setStatus(deposit.status);
      setEta(deposit.eta);
    },
    shouldStop: (deposit) => TERMINAL_STATUSES.includes(deposit.status),
  });

  const isComplete = status === "completed";

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
