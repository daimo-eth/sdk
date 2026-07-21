import { useCallback, useState } from "react";

import type {
  AccountDeposit,
  AccountRail,
  DepositPaymentInfo,
} from "../../../common/account.js";
import { formatAmountInput } from "../../formatAmount.js";
import { getLocale, t } from "../../hooks/locale.js";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";
import { useRequestToPayDeposit } from "../../hooks/useRequestToPayDeposit.js";
import { PrimaryButton, SecondaryButton } from "../buttons.js";
import { Countdown, useCountdown } from "../Countdown.js";
import { ErrorPage } from "../ErrorPage.js";
import { CopyIcon, ExpiredIcon } from "../icons.js";
import { QRCode } from "../QRCode.js";
import { CenteredContent, PageHeader } from "../shared.js";
import { Skeleton } from "../Skeleton.js";

type AccountRequestToPayPageProps = {
  sessionId: string;
  clientSecret: string;
  rail: AccountRail;
  resumePayment: boolean;
  onAdvance: (deposit: AccountDeposit) => void;
  onRetry: (depositAmount: string) => Promise<void>;
};

/** Generic renderer for one exact, expiring QR/code payment request. */
export function AccountRequestToPayPage({
  sessionId,
  clientSecret,
  rail,
  resumePayment,
  onAdvance,
  onRetry,
}: AccountRequestToPayPageProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const {
    depositAmount,
    payment,
    providerExpired,
    contractMismatch,
    error,
    retry,
  } = useRequestToPayDeposit({
    sessionId,
    clientSecret,
    rail,
    resumePayment,
    onAdvance,
  });
  const expiresAt = payment?.expiresAt ?? 0;
  const { remainingS, isExpired: clockExpired } = useCountdown(expiresAt, 0);
  const isExpired = providerExpired || clockExpired;

  const handleRetry = useCallback(async () => {
    if (!payment || !depositAmount || isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      await onRetry(depositAmount);
    } catch {
      setRetryError(t.errorDepositFailed);
    } finally {
      setIsRetrying(false);
    }
  }, [depositAmount, isRetrying, onRetry, payment]);

  if (error) {
    return <ErrorPage message={error} retryText={t.tryAgain} onRetry={retry} />;
  }
  if (!depositAmount || contractMismatch) {
    return <ErrorPage message={t.errorDepositFailed} hideRetry />;
  }
  if (!payment) return <RequestSkeleton />;

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader
        title={isExpired ? payment.ui.expiredTitle : payment.ui.title}
      />
      <CenteredContent>
        {isExpired ? (
          <RequestToPayExpiredContent
            payment={payment}
            isRetrying={isRetrying}
            retryError={retryError}
            onRetry={handleRetry}
          />
        ) : (
          <RequestToPayActiveContent
            payment={payment}
            remainingS={remainingS}
          />
        )}
      </CenteredContent>
    </div>
  );
}

export function RequestToPayExpiredContent({
  payment,
  isRetrying,
  retryError,
  onRetry,
}: {
  payment: Extract<DepositPaymentInfo, { flow: "request-to-pay" }>;
  isRetrying: boolean;
  retryError: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-6"
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        className="daimo-w-20 daimo-h-20 daimo-rounded-full daimo-flex daimo-items-center daimo-justify-center"
        style={{ backgroundColor: "var(--daimo-error-light)" }}
      >
        <ExpiredIcon />
      </div>
      <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
        {payment.ui.expiredInstructions}
      </p>
      <SecondaryButton onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? payment.ui.retryingLabel : payment.ui.retryLabel}
      </SecondaryButton>
      {retryError && (
        <p className="daimo-text-center daimo-text-sm daimo-text-[var(--daimo-error)]">
          {retryError}
        </p>
      )}
    </div>
  );
}

export function RequestToPayActiveContent({
  payment,
  remainingS,
}: {
  payment: Extract<DepositPaymentInfo, { flow: "request-to-pay" }>;
  remainingS: number;
}) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-items-center daimo-gap-5">
      <div
        className="daimo-w-full daimo-max-w-[220px]"
        role="img"
        aria-label={`${payment.ui.codeLabel} QR code`}
      >
        <QRCode value={payment.paymentCode} placeholderDensity="long" />
      </div>
      <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
        {payment.instructions}
      </p>
      <div className="daimo-w-full daimo-rounded-[var(--daimo-radius-sm)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-4 daimo-text-center">
        <p className="daimo-text-xs daimo-text-[var(--daimo-text-secondary)]">
          {payment.ui.codeLabel}
        </p>
        <p className="daimo-mt-1 daimo-text-xl daimo-font-semibold daimo-tabular-nums">
          {formatFiatAmount(
            payment.payableAmount,
            payment.currency.code,
            payment.currency.symbol,
          )}
        </p>
        <p
          className="daimo-mt-1 daimo-text-xs daimo-text-[var(--daimo-text-secondary)]"
          aria-label={`Expected settlement ${payment.expectedSettlementAmount} ${payment.destinationToken.symbol}`}
        >
          {formatAmountInput(payment.expectedSettlementAmount)}{" "}
          {payment.destinationToken.symbol}
        </p>
      </div>
      <PrimaryButton
        onClick={() => copy(payment.paymentCode)}
        icon={<CopyIcon size={16} copied={copied} />}
      >
        {copied ? payment.ui.actionCompletedLabel : payment.ui.actionLabel}
      </PrimaryButton>
      <Countdown remainingS={remainingS} isExpired={false} />
    </div>
  );
}

export function formatFiatAmount(
  amount: string,
  currencyCode: string,
  currencySymbol: string,
  locale = getLocale(),
): string {
  const value = Number(amount);
  if (!Number.isFinite(value))
    return `${currencySymbol}${amount} ${currencyCode}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencySymbol}${value.toFixed(2)} ${currencyCode}`;
  }
}

function RequestSkeleton() {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title={t.loading} />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-items-center daimo-gap-5">
          <div className="daimo-w-full daimo-max-w-[220px]">
            <QRCode placeholderDensity="long" />
          </div>
          <Skeleton className="daimo-h-4 daimo-w-64" rounded="sm" />
          <Skeleton className="daimo-h-12 daimo-w-full" rounded="lg" />
        </div>
      </CenteredContent>
    </div>
  );
}
