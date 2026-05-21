import { useState, type ReactNode } from "react";

import type {
  AccountDepositEta,
  AccountDepositStatus,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { ConfirmationSpinner } from "../ConfirmationSpinner.js";
import { ExternalLinkIcon } from "../icons.js";
import { ErrorPage } from "../ErrorPage.js";
import { CenteredContent, PageHeader } from "../shared.js";

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
  const receiptUrl = `${baseUrl}/receipt?id=${sessionId}`;
  const accountUrl = `${baseUrl}/account/activity?session=${encodeURIComponent(sessionId)}`;

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
        <ActionLink
          href={accountUrl}
          icon={<AccountIcon />}
          label={t.accountViewAccount}
        />
        <ActionLink
          href={receiptUrl}
          icon={<ReceiptIcon />}
          label={t.showReceipt}
        />
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

function ActionLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="daimo-flex daimo-w-full daimo-max-w-xs daimo-min-h-[52px] daimo-touch-action-manipulation daimo-items-center daimo-gap-3 daimo-rounded-[var(--daimo-radius-lg)] daimo-bg-[var(--daimo-surface-secondary)] daimo-px-4 daimo-py-3 daimo-text-[var(--daimo-text)] daimo-transition-[background-color] daimo-duration-100 daimo-ease hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)]"
    >
      <span className="daimo-text-[var(--daimo-text-muted)]">{icon}</span>
      <span className="daimo-flex-1 daimo-text-sm daimo-font-medium">
        {label}
      </span>
      <ExternalLinkIcon
        size={14}
        className="daimo-shrink-0 daimo-text-[var(--daimo-text-muted)]"
      />
    </a>
  );
}

function AccountIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3v18l2-1.25L9 21l2-1.25L13 21l2-1.25L17 21l2-1.25V3l-2 1.25L15 3l-2 1.25L11 3 9 4.25 7 3 5 4.25Z" />
      <path d="M8 9h8" />
      <path d="M8 13h8" />
    </svg>
  );
}
