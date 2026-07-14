import { useCallback, useState } from "react";

import type {
  AccountDeposit,
  AccountRail,
  DepositPaymentInfo,
} from "../../../common/account.js";
import { t } from "../../hooks/locale.js";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";
import { useSignedDraftDepositLifecycle } from "../../hooks/useSignedDraftDepositLifecycle.js";
import { PrimaryButton } from "../buttons.js";
import { Countdown, useCountdown } from "../Countdown.js";
import { ErrorPage } from "../ErrorPage.js";
import { CopyIcon } from "../icons.js";
import { QRCode } from "../QRCode.js";
import { CenteredContent, PageHeader, resolveIconUrl } from "../shared.js";
import { Skeleton } from "../Skeleton.js";
import { AccountRequestToPayExpiredContent } from "./AccountRequestToPayExpiredContent.js";

const DEFAULT_REQUEST_LIFETIME_S = 10 * 60;

type RequestToPayPayment = Extract<
  DepositPaymentInfo,
  { flow: "request-to-pay" }
>;

type AccountRequestToPayPageProps = {
  sessionId: string;
  clientSecret: string;
  baseUrl: string;
  rail: AccountRail;
  icon?: string;
  onAdvance: (deposit: AccountDeposit) => void;
  onRetry: (depositAmount: string) => Promise<void>;
};

/** Creates and renders an expiring QR/code payment request. */
export function AccountRequestToPayPage({
  sessionId,
  clientSecret,
  baseUrl,
  rail,
  icon,
  onAdvance,
  onRetry,
}: AccountRequestToPayPageProps) {
  const { copy, copied } = useCopyToClipboard();
  const [isRetrying, setIsRetrying] = useState(false);
  const {
    depositAmount,
    payment,
    error: draftError,
    retry: retryDraft,
  } = useSignedDraftDepositLifecycle({
    sessionId,
    clientSecret,
    rail,
    isPayment: isRequestToPayPayment,
    onAdvance,
  });
  const expiresAt = parseExpiry(payment?.expiresAt);
  const { remainingS, isExpired } = useCountdown(
    expiresAt,
    DEFAULT_REQUEST_LIFETIME_S,
  );

  const handleRetry = useCallback(async () => {
    if (!depositAmount || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry(depositAmount);
    } finally {
      setIsRetrying(false);
    }
  }, [depositAmount, isRetrying, onRetry]);

  if (draftError) {
    return (
      <ErrorPage
        message={draftError}
        retryText={t.tryAgain}
        onRetry={retryDraft}
      />
    );
  }

  if (!depositAmount) {
    return <ErrorPage message={t.errorDepositFailed} hideRetry />;
  }

  if (!payment) {
    return <RequestSkeleton baseUrl={baseUrl} icon={icon} />;
  }

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={payment.title} />
      <CenteredContent>
        {isExpired ? (
          <AccountRequestToPayExpiredContent
            sessionId={sessionId}
            message={payment.expiredMessage}
            supportSubject={`Expired ${payment.title} code`}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        ) : (
          <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-items-center daimo-gap-5">
            <div className="daimo-w-full daimo-max-w-[220px]">
              <QRCode
                value={payment.code}
                placeholderDensity="long"
                image={<RequestLogo baseUrl={baseUrl} icon={icon} />}
              />
            </div>
            <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
              {payment.instructions}
            </p>
            <PrimaryButton
              onClick={() => copy(payment.code)}
              icon={<CopyIcon size={16} copied={copied} />}
            >
              {copied ? t.accountBankDetailsCopied : payment.copyLabel}
            </PrimaryButton>
            <Countdown
              remainingS={remainingS}
              isExpired={isExpired}
              totalS={DEFAULT_REQUEST_LIFETIME_S}
            />
          </div>
        )}
      </CenteredContent>
    </div>
  );
}

function RequestSkeleton({ baseUrl, icon }: { baseUrl: string; icon?: string }) {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title="Payment" />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-items-center daimo-gap-5">
          <div className="daimo-w-full daimo-max-w-[220px]">
            <QRCode
              placeholderDensity="long"
              image={<RequestLogo baseUrl={baseUrl} icon={icon} />}
            />
          </div>
          <Skeleton className="daimo-h-4 daimo-w-64" rounded="sm" />
          <Skeleton className="daimo-h-12 daimo-w-full" rounded="lg" />
        </div>
      </CenteredContent>
    </div>
  );
}

function RequestLogo({ baseUrl, icon }: { baseUrl: string; icon?: string }) {
  if (!icon) return null;
  return (
    <img
      src={resolveIconUrl(icon, baseUrl)}
      alt=""
      className="daimo-h-full daimo-w-full daimo-object-contain"
    />
  );
}

function isRequestToPayPayment(
  payment: DepositPaymentInfo,
): payment is RequestToPayPayment {
  return payment.flow === "request-to-pay";
}

function parseExpiry(value?: string): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}
