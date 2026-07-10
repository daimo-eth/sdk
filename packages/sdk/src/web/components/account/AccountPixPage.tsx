import { useEffect } from "react";

import type { DepositPaymentInfo } from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import {
  useAccountFlow,
  useSessionDepositState,
} from "../../hooks/useAccountFlow.js";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";
import { useDepositPoller } from "../../hooks/useDepositPoller.js";
import { useDraftDeposit } from "../../hooks/useDraftDeposit.js";
import { PrimaryButton } from "../buttons.js";
import { Countdown, useCountdown } from "../Countdown.js";
import { ErrorPage } from "../ErrorPage.js";
import { CopyIcon } from "../icons.js";
import { QRCode } from "../QRCode.js";
import { CenteredContent, PageHeader, resolveIconUrl } from "../shared.js";
import { Skeleton } from "../Skeleton.js";

const PIX_TICKET_LIFETIME_S = 10 * 60;

type PixPayment = Extract<DepositPaymentInfo, { flow: "pix" }>;

type AccountPixPageProps = {
  sessionId: string;
  clientSecret: string;
  baseUrl: string;
  icon?: string;
  onAdvance: () => void;
};

/** Creates a PIX ticket, renders its QR/BR Code, and waits for payment. */
export function AccountPixPage({
  sessionId,
  clientSecret,
  baseUrl,
  icon,
  onAdvance,
}: AccountPixPageProps) {
  const client = useDaimoClient();
  const accountFlow = useAccountFlow();
  const { depositState, setDepositState } = useSessionDepositState(sessionId);
  const depositAmount = depositState?.depositAmount ?? "";
  const { copy, copied } = useCopyToClipboard();
  const {
    payment: draftedPayment,
    error: draftError,
    retry: retryDraft,
  } = useDraftDeposit({
    client,
    accountFlow,
    sessionId,
    rail: "pix",
    depositAmount,
    enabled: depositAmount !== "",
    draftMode: "signed",
  });
  const currentDepositId =
    depositState?.depositAmount === depositAmount &&
    (depositState.kind === "drafted" || depositState.kind === "started")
      ? depositState.depositId
      : null;
  const startedPayment =
    depositState?.kind === "started" && isPixPayment(depositState.payment)
      ? depositState.payment
      : null;
  const payment =
    startedPayment ??
    (draftedPayment && isPixPayment(draftedPayment) ? draftedPayment : null);
  const expiresAt = parseExpiry(payment?.expiresAt);
  const { remainingS, isExpired } = useCountdown(
    expiresAt,
    PIX_TICKET_LIFETIME_S,
  );

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
    onUpdate(deposit) {
      if (
        deposit.status !== "initiated" &&
        deposit.status !== "awaiting_payment"
      ) {
        onAdvance();
      }
    },
  });

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
    return <PixSkeleton baseUrl={baseUrl} icon={icon} />;
  }

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title="PIX" />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-items-center daimo-gap-5">
          <div className="daimo-w-full daimo-max-w-[220px]">
            <QRCode
              value={payment.brCode}
              placeholderDensity="long"
              image={<PixLogo baseUrl={baseUrl} icon={icon} />}
            />
          </div>
          <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            {payment.instructions}
          </p>
          <PrimaryButton
            onClick={() => copy(payment.brCode)}
            disabled={isExpired}
            icon={<CopyIcon size={16} copied={copied} />}
          >
            {copied ? t.accountBankDetailsCopied : t.accountPixCopyCode}
          </PrimaryButton>
          <Countdown
            remainingS={remainingS}
            isExpired={isExpired}
            totalS={PIX_TICKET_LIFETIME_S}
          />
        </div>
      </CenteredContent>
    </div>
  );
}

function PixSkeleton({ baseUrl, icon }: { baseUrl: string; icon?: string }) {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title="PIX" />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-items-center daimo-gap-5">
          <div className="daimo-w-full daimo-max-w-[220px]">
            <QRCode
              placeholderDensity="long"
              image={<PixLogo baseUrl={baseUrl} icon={icon} />}
            />
          </div>
          <Skeleton className="daimo-h-4 daimo-w-64" rounded="sm" />
          <Skeleton className="daimo-h-12 daimo-w-full" rounded="lg" />
        </div>
      </CenteredContent>
    </div>
  );
}

function PixLogo({ baseUrl, icon }: { baseUrl: string; icon?: string }) {
  if (!icon) return null;
  return (
    <img
      src={resolveIconUrl(icon, baseUrl)}
      alt=""
      className="daimo-h-full daimo-w-full daimo-object-contain"
    />
  );
}

function isPixPayment(payment: DepositPaymentInfo): payment is PixPayment {
  return payment.flow === "pix";
}

function parseExpiry(value?: string): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}
