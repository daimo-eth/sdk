import { useCallback, useEffect, useState } from "react";

import type {
  AccountDeposit,
  AccountRail,
  DepositPaymentInfo,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { useDraftDeposit } from "../../hooks/useDraftDeposit.js";
import type { DaimoPlatform } from "../../platform.js";
import { PrimaryButton, SecondaryButton } from "../buttons.js";
import { Countdown, useCountdown } from "../Countdown.js";
import { ErrorPage } from "../ErrorPage.js";
import { ExternalLinkIcon, ExpiredIcon } from "../icons.js";
import { CenteredContent, PageHeader } from "../shared.js";
import { Skeleton } from "../Skeleton.js";
import type { ApprovalPayment } from "./accountPaymentCompatibility.js";
import {
  getApprovalContract,
  isExpiredApproval,
} from "./accountPaymentCompatibility.js";
import { formatFiatAmount } from "./AccountRequestToPayPage.js";
import { openDeeplink } from "./openDeeplink.js";

type AccountApprovalPageProps = {
  sessionId: string;
  clientSecret: string;
  rail: AccountRail;
  platform: DaimoPlatform;
  resumePayment: boolean;
  onAdvance: (deposit: AccountDeposit) => void;
  onRetry: (depositAmount: string) => Promise<void>;
};

/** Hosted or passive external-app approval with expiry and continued polling. */
export function AccountApprovalPage({
  sessionId,
  clientSecret,
  rail,
  platform,
  resumePayment,
  onAdvance,
  onRetry,
}: AccountApprovalPageProps) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState, clearDepositState } =
    useSessionDepositState(sessionId);
  const depositAmount = depositState?.depositAmount ?? "";
  const [providerExpired, setProviderExpired] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const draftConfig = getApprovalDraftConfig(resumePayment, depositAmount);
  const {
    payment: draftedPayment,
    error,
    retry,
  } = useDraftDeposit({
    client,
    accountFlow,
    sessionId,
    rail,
    depositAmount,
    ...draftConfig,
  });
  const candidatePayment =
    depositState?.kind === "started" ? depositState.payment : draftedPayment;
  const payment = candidatePayment
    ? getApprovalContract(candidatePayment)
    : null;
  const currentDepositId =
    depositState?.kind === "drafted" || depositState?.kind === "started"
      ? depositState.depositId
      : null;

  useEffect(() => {
    if (!payment || !currentDepositId || depositState?.kind === "started") {
      return;
    }
    setDepositState({
      depositAmount,
      kind: "started",
      depositId: currentDepositId,
      payment,
    });
  }, [
    currentDepositId,
    depositAmount,
    depositState?.kind,
    payment,
    setDepositState,
  ]);

  useDepositPoller({
    client,
    sessionId,
    clientSecret,
    intervalMs: payment?.polling.delayMs,
    onUpdate(deposit) {
      if (deposit.status === "expired") {
        setProviderExpired(true);
        return;
      }
      if (
        deposit.status !== "initiated" &&
        deposit.status !== "awaiting_payment"
      ) {
        clearDepositState();
        onAdvance(deposit);
      }
    },
    shouldStop: (deposit) =>
      deposit.status === "expired" ||
      deposit.status === "failed" ||
      deposit.status === "completed",
  });

  const expiresAt = payment?.expiresAt ?? 0;
  const { remainingS, isExpired: clockExpired } = useCountdown(expiresAt, 0);
  const isExpired =
    providerExpired ||
    clockExpired ||
    (payment != null && isExpiredApproval(payment));

  const handleOpen = useCallback(() => {
    if (!payment) return;
    const url =
      payment.flow === "hosted-approval"
        ? payment.approvalUrl
        : payment.action?.url;
    if (!url) return;
    openDeeplink({ type: "redirect", url }, platform, { newWindow: true });
    setHasOpened(true);
  }, [payment, platform]);

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
  if (candidatePayment != null && payment == null) {
    return <ErrorPage message={t.errorDepositFailed} hideRetry />;
  }
  if (!payment) return <ApprovalSkeleton />;

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader
        title={isExpired ? payment.ui.expiredTitle : payment.ui.title}
      />
      <CenteredContent>
        {isExpired ? (
          <ApprovalExpiredContent
            payment={payment}
            isRetrying={isRetrying}
            retryError={retryError}
            onRetry={handleRetry}
          />
        ) : (
          <ApprovalActiveContent
            payment={payment}
            remainingS={remainingS}
            hasOpened={hasOpened}
            onOpen={handleOpen}
          />
        )}
      </CenteredContent>
    </div>
  );
}

/** Fresh approval entry signs and starts; resume only replays provider info. */
export function getApprovalDraftConfig(
  resumePayment: boolean,
  depositAmount: string,
): { enabled: boolean; draftMode: "plain" | "signed" } {
  return {
    enabled: depositAmount !== "",
    draftMode: resumePayment ? "plain" : "signed",
  };
}

export function ApprovalActiveContent({
  payment,
  remainingS,
  hasOpened,
  onOpen,
}: {
  payment: ApprovalPayment;
  remainingS: number;
  hasOpened: boolean;
  onOpen: () => void;
}) {
  const instructions = payment.ui.instructions;
  const actionLabel = getApprovalActionLabel(payment, hasOpened);
  return (
    <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-items-center daimo-gap-5">
      <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
        {instructions}
      </p>
      <div className="daimo-w-full daimo-rounded-[var(--daimo-radius-sm)] daimo-bg-[var(--daimo-surface-secondary)] daimo-p-4 daimo-text-center">
        {payment.flow === "external-app-approval" && (
          <>
            <p className="daimo-text-xs daimo-text-[var(--daimo-text-secondary)]">
              {payment.ui.destinationLabel}
            </p>
            <p className="daimo-mt-1 daimo-text-lg daimo-font-semibold daimo-tabular-nums">
              {payment.maskedDestination}
            </p>
          </>
        )}
        <p className="daimo-mt-3 daimo-text-xl daimo-font-semibold daimo-tabular-nums">
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
          {payment.expectedSettlementAmount} {payment.destinationToken.symbol}
        </p>
      </div>
      {actionLabel && (
        <PrimaryButton onClick={onOpen} icon={<ExternalLinkIcon size={14} />}>
          {actionLabel}
        </PrimaryButton>
      )}
      <Countdown remainingS={remainingS} isExpired={false} />
    </div>
  );
}

export function ApprovalExpiredContent({
  payment,
  isRetrying,
  retryError,
  onRetry,
}: {
  payment: ApprovalPayment;
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

export function getApprovalActionLabel(
  payment: ApprovalPayment,
  hasOpened: boolean,
): string | null {
  if (payment.flow === "hosted-approval") {
    return hasOpened ? payment.ui.reopenLabel : payment.ui.openLabel;
  }
  return payment.action?.label ?? null;
}

function ApprovalSkeleton() {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title={t.loading} />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-items-center daimo-gap-5">
          <Skeleton className="daimo-h-4 daimo-w-64" rounded="sm" />
          <Skeleton className="daimo-h-28 daimo-w-full" rounded="lg" />
          <Skeleton className="daimo-h-12 daimo-w-full" rounded="lg" />
        </div>
      </CenteredContent>
    </div>
  );
}
