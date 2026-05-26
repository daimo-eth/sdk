import SumsubWebSdk from "@sumsub/websdk-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { EnrollmentResponse } from "../../../common/account.js";
import type { NavNodeFiat } from "../../api/navTree.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { SecondaryButton } from "../buttons.js";
import { ErrorPage } from "../ErrorPage.js";
import { ErrorIcon, ExternalLinkIcon } from "../icons.js";
import { Skeleton, SkeletonText } from "../Skeleton.js";
import {
  CenteredContent,
  ContactSupportButton,
  PageHeader,
} from "../shared.js";
import {
  AccountKycInfoPage,
  AccountKycInfoSkeleton,
} from "./AccountKycInfoPage.js";

type AccountEnrollmentPageProps = {
  node: NavNodeFiat;
  sessionId: string;
  onBack: () => void;
  onReady: () => void;
  /** Called when enrollment requires a phone OTP (e.g. Coinbase Headless). */
  onPhoneRequired: () => void;
};

/** Actions that should trigger polling — the state is still advancing. */
const POLLING_ACTIONS = new Set([
  "kyc_required",
  "kyc_retry",
  "kyc_pending_review",
  "hosted_agreement_required",
  "provider_pending",
]);

/** After KYC submission, only these actions represent forward progress.
 *  Anything else (e.g. stale kyc_required) is suppressed until the
 *  webhook arrives and the server catches up. */
const FORWARD_FROM_KYC = new Set([
  "kyc_pending_review",
  "kyc_retry",
  "kyc_rejected_final",
  "not_eligible",
  "hosted_agreement_required",
  "provider_pending",
  "phone_required",
  "active",
  "suspended",
  "error",
]);
export function AccountEnrollmentPage({
  node,
  sessionId,
  onBack,
  onReady,
  onPhoneRequired,
}: AccountEnrollmentPageProps) {
  const rail = node.fiatMethod;
  const account = useAccountFlow();
  const client = useDaimoClient();
  const [response, setResponse] = useState<EnrollmentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kycAccepted, setKycAccepted] = useState(false);
  const [isCheckingAgreement, setIsCheckingAgreement] = useState(false);
  const started = useRef(false);
  const responseRef = useRef<EnrollmentResponse | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  // After KYC submit, suppress stale responses until webhook arrives
  const awaitingWebhook = useRef(false);

  const fetchEnrollment = useCallback(async () => {
    if (!account) return;
    const isInitial = responseRef.current == null;
    const previousAction = responseRef.current?.action;
    if (isInitial) setIsLoading(true);

    let result: EnrollmentResponse | null;
    try {
      result = await account.startEnrollment(client, { rail });
    } catch (err) {
      console.error("[enrollment] fetch failed:", err);
      if (awaitingWebhook.current) return;
      result = { action: "error", message: t.errorGeneric, retryable: true };
    }

    if (isInitial) setIsLoading(false);
    setIsCheckingAgreement(false);
    if (!result) return;

    // While awaiting webhook, only accept forward progress
    if (awaitingWebhook.current) {
      if (FORWARD_FROM_KYC.has(result.action)) {
        awaitingWebhook.current = false;
      } else {
        return;
      }
    }

    if (
      previousAction === "hosted_agreement_required" &&
      result.action === "active"
    ) {
      const pending: EnrollmentResponse = { action: "provider_pending" };
      responseRef.current = pending;
      setResponse(pending);
      if (readyTimeoutRef.current != null) {
        window.clearTimeout(readyTimeoutRef.current);
      }
      readyTimeoutRef.current = window.setTimeout(() => {
        responseRef.current = result;
        setResponse(result);
        onReady();
      }, 900);
      return;
    }

    if (result.action === "active") {
      responseRef.current = result;
      setResponse(result);
      onReady();
    } else if (result.action === "phone_required") {
      // Coinbase Headless has no KYC — phone OTP is the only step.
      // Navigate to the phone entry screen; the server will flip to "active"
      // once we return from phone verification.
      responseRef.current = result;
      setResponse(result);
      onPhoneRequired();
    } else if (
      !responseRef.current ||
      responseRef.current.action !== result.action
    ) {
      responseRef.current = result;
      setResponse(result);
    }
  }, [account, client, rail, onReady, onPhoneRequired]);

  /** Called when SumSub reports docs submitted. Optimistically show review. */
  const handleKycSubmitted = useCallback(() => {
    awaitingWebhook.current = true;
    responseRef.current = { action: "kyc_pending_review" };
    setResponse({ action: "kyc_pending_review" });
  }, []);

  // Initial fetch
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetchEnrollment();
  }, [fetchEnrollment]);

  // Poll while the state is still advancing
  useEffect(() => {
    if (!response || !POLLING_ACTIONS.has(response.action)) return;
    const interval = setInterval(fetchEnrollment, 2000);
    return () => clearInterval(interval);
  }, [response?.action, fetchEnrollment]);

  useEffect(() => {
    return () => {
      if (readyTimeoutRef.current != null) {
        window.clearTimeout(readyTimeoutRef.current);
      }
    };
  }, []);

  // --- Render ---

  if (isLoading) {
    return rail === "apple_pay" ? (
      <PhoneEntrySkeleton onBack={onBack} />
    ) : (
      <AccountKycInfoSkeleton node={node} onBack={onBack} />
    );
  }

  if (!response) return null;

  switch (response.action) {
    case "kyc_required":
      if (!kycAccepted) {
        return (
          <AccountKycInfoPage
            node={node}
            onContinue={() => setKycAccepted(true)}
            onBack={onBack}
          />
        );
      }
      return (
        <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0 daimo-pt-14">
          <SumSubWidget
            kycToken={response.kycToken}
            onComplete={handleKycSubmitted}
          />
        </div>
      );

    case "kyc_retry":
      return (
        <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0 daimo-pt-14">
          <SumSubWidget
            kycToken={response.kycToken}
            onComplete={handleKycSubmitted}
          />
        </div>
      );

    case "kyc_pending_review":
      return (
        <EnrollmentWaiting
          title={t.accountEnrollmentPending}
          label={t.accountEnrollmentPendingDesc}
          onBack={onBack}
        />
      );

    case "hosted_agreement_required":
      return (
        <HostedAgreementPage
          step={response}
          isChecking={isCheckingAgreement}
          onRefresh={async () => {
            setIsCheckingAgreement(true);
            await fetchEnrollment();
          }}
          onBack={onBack}
        />
      );

    case "provider_pending":
      return (
        <EnrollmentWaiting
          title={t.accountProviderPending}
          label={t.accountProviderPendingDesc}
        />
      );

    case "kyc_rejected_final":
      return (
        <EnrollmentTerminal
          title={t.accountEnrollmentRejected}
          message={response.reason}
          sessionId={sessionId}
        />
      );

    case "not_eligible":
      return (
        <EnrollmentIneligible
          message={response.reason}
          sessionId={sessionId}
          onBack={onBack}
        />
      );

    case "suspended":
      return (
        <EnrollmentTerminal
          title={t.accountSuspended}
          message={response.reason}
          sessionId={sessionId}
        />
      );

    case "error":
      return (
        <ErrorPage
          message={response.message}
          sessionId={sessionId}
          retryText={t.tryAgain}
          onRetry={response.retryable ? fetchEnrollment : undefined}
          hideRetry={!response.retryable}
        />
      );

    case "phone_required":
      // Navigation is triggered in fetchEnrollment; render a waiting state
      // here to avoid flicker until the modal pushes the phone screen.
      return <PhoneEntrySkeleton onBack={onBack} />;

    case "active":
      return null;
  }
}

// --- Sub-components ---

function PhoneEntrySkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      aria-busy="true"
      aria-label={t.loading}
    >
      <PageHeader title={t.accountPhone} onBack={onBack} />

      <CenteredContent>
        <Skeleton
          className="daimo-h-4 daimo-w-full daimo-max-w-[300px]"
          rounded="sm"
        />
        <Skeleton className="daimo-h-[56px] daimo-w-full daimo-max-w-xs" />
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <Skeleton className="daimo-h-[54px] daimo-w-full daimo-max-w-xs" />
      </div>
    </div>
  );
}

function EnrollmentIneligible({
  message,
  sessionId,
  onBack,
}: {
  message: string;
  sessionId: string;
  onBack: () => void;
}) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountRegionUnavailableTitle} onBack={onBack} />
      <CenteredContent>
        <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-4 daimo-px-6 daimo-text-center">
          <div
            className="daimo-flex daimo-h-16 daimo-w-16 daimo-items-center daimo-justify-center daimo-rounded-full"
            style={{
              backgroundColor:
                "var(--daimo-warning-light, var(--daimo-surface-secondary))",
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--daimo-warning, #f59e0b)" }}
              aria-hidden="true"
            >
              <path d="M12 3 2.8 19a1 1 0 0 0 .87 1.5h16.66A1 1 0 0 0 21.2 19z" />
              <path d="M12 9v4.5" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <div className="daimo-flex daimo-flex-col daimo-gap-2">
            <h2 className="daimo-text-xl daimo-font-semibold daimo-text-[var(--daimo-text)]">
              {t.accountRegionUnavailableHeading}
            </h2>
            <p className="daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
              {t.accountRegionUnavailableDescription}
            </p>
          </div>
        </div>
      </CenteredContent>
      <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-3 daimo-px-6 daimo-pb-6">
        <SecondaryButton onClick={onBack}>
          {t.accountRegionUnavailableCta}
        </SecondaryButton>
        <ContactSupportButton
          subject={t.accountRegionUnavailableTitle}
          info={{ sessionId, error: message }}
        />
      </div>
    </div>
  );
}

/** Terminal error — specific title, error icon, message, and support link. */
function EnrollmentTerminal({
  title,
  message,
  sessionId,
}: {
  title: string;
  message: string;
  sessionId: string;
}) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title} />
      <div className="daimo-flex-1 daimo-flex daimo-flex-col daimo-items-center daimo-justify-center daimo-p-6 daimo-gap-6">
        <div
          className="daimo-w-16 daimo-h-16 daimo-rounded-full daimo-flex daimo-items-center daimo-justify-center"
          style={{ backgroundColor: "var(--daimo-error-light)" }}
        >
          <ErrorIcon size={32} />
        </div>
        <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-leading-relaxed daimo-px-4">
          {message}
        </p>
        <ContactSupportButton
          subject={title}
          info={{ sessionId, error: message }}
        />
      </div>
    </div>
  );
}

/** Waiting view — stable skeleton placeholders for advancing account states. */
function EnrollmentWaiting({
  title,
  label,
  onBack,
}: {
  title: string;
  label?: string;
  onBack?: () => void;
}) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title} onBack={onBack} />
      <CenteredContent>
        <div
          className="daimo-flex daimo-w-full daimo-max-w-[260px] daimo-flex-col daimo-items-center daimo-gap-4"
          aria-busy="true"
          aria-label={label ?? t.loading}
        >
          <Skeleton className="daimo-h-14 daimo-w-14" rounded="full" />
          <SkeletonText
            lines={label ? 2 : 1}
            widths={label ? ["88%", "64%"] : ["56%"]}
          />
        </div>
      </CenteredContent>
    </div>
  );
}

/** Hosted external agreement step. Polling drives completion. */
function HostedAgreementPage({
  step,
  isChecking,
  onRefresh,
  onBack,
}: {
  step: Extract<EnrollmentResponse, { action: "hosted_agreement_required" }>;
  isChecking: boolean;
  onRefresh: () => Promise<void>;
  onBack: () => void;
}) {
  const openAgreement = useCallback(() => {
    if (postNativeOpenUrl(step.url)) return;
    window.open(step.url, "_blank", "noopener,noreferrer");
  }, [step.url]);

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={step.title} onBack={onBack} />

      <div className="daimo-flex-1 daimo-min-h-0 daimo-overflow-y-auto daimo-px-5 daimo-pb-3">
        <div className="daimo-mx-auto daimo-flex daimo-w-full daimo-max-w-[420px] daimo-flex-col daimo-gap-3">
          <p className="daimo-px-1 daimo-text-xs daimo-text-[var(--daimo-text-muted)] daimo-text-center daimo-leading-relaxed">
            {step.description}
          </p>

          <div
            className="daimo-w-full daimo-overflow-hidden daimo-rounded-[22px] daimo-border daimo-bg-white"
            style={{
              height: "clamp(460px, 64svh, 680px)",
              borderColor: "var(--daimo-border)",
              boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)",
            }}
          >
            <iframe
              src={step.url}
              title={step.title}
              className="daimo-block daimo-h-full daimo-w-full daimo-border-0"
            />
          </div>

          <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-2">
            <p className="daimo-mx-auto daimo-max-w-[340px] daimo-text-[11px] daimo-text-[var(--daimo-text-muted)] daimo-text-center daimo-leading-relaxed">
              {step.fallbackDescription}
            </p>
            <button
              type="button"
              onClick={openAgreement}
              disabled={isChecking}
              aria-label={step.openExternalLabel}
              title={step.openExternalLabel}
              className="daimo-inline-flex daimo-min-h-[44px] daimo-items-center daimo-justify-center daimo-gap-2 daimo-rounded-full daimo-px-4 daimo-text-xs daimo-font-medium daimo-transition-[background-color,border-color,color] daimo-duration-150 daimo-ease-out disabled:daimo-opacity-50"
              style={{
                color: "var(--daimo-text-secondary)",
                backgroundColor: "var(--daimo-surface-secondary)",
                touchAction: "manipulation",
              }}
            >
              <ExternalLinkIcon size={14} className="daimo-text-current" />
              <span>{step.openExternalLabel}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="daimo-mx-auto daimo-w-full daimo-max-w-[420px] daimo-shrink-0 daimo-px-5 daimo-pb-5 daimo-flex daimo-flex-col daimo-gap-2">
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={isChecking}
          className="daimo-relative daimo-mx-auto daimo-w-full daimo-max-w-xs daimo-min-h-[44px] daimo-rounded-[var(--daimo-radius-lg)] daimo-border-0 daimo-bg-[var(--daimo-surface-secondary)] daimo-px-6 daimo-py-4 daimo-text-[var(--daimo-text)] daimo-touch-action-manipulation daimo-transition-[background-color] daimo-duration-100 daimo-ease disabled:daimo-text-[var(--daimo-text-muted)]"
        >
          <span
            className="daimo-pointer-events-none daimo-absolute daimo-left-1/2 daimo-top-1/2 daimo-whitespace-nowrap daimo-text-center daimo-text-sm daimo-font-medium daimo-leading-none daimo--translate-y-1/2"
            style={{ transform: "translate(calc(-50% + 1px), -50%)" }}
          >
            {isChecking ? t.accountProviderPending : step.continueLabel}
          </span>
        </button>
        <p className="daimo-text-[11px] daimo-text-[var(--daimo-text-muted)] daimo-text-center daimo-leading-relaxed daimo-px-4">
          {isChecking ? step.checkingDescription : step.autoContinueDescription}
        </p>
      </div>
    </div>
  );
}

function postNativeOpenUrl(url: string): boolean {
  const w = window as {
    webkit?: {
      messageHandlers?: { daimoPay?: { postMessage(m: unknown): void } };
    };
  };
  const handler = w.webkit?.messageHandlers?.daimoPay;
  if (!handler) return false;
  handler.postMessage({ type: "openUrl", url });
  return true;
}

/** SumSub identity verification widget. */
function SumSubWidget({
  kycToken,
  onComplete,
}: {
  kycToken: string;
  onComplete: () => void;
}) {
  const handleMessage = useCallback(
    (type: string) => {
      console.log("[sumsub] event:", type);
      if (type === "idCheck.onApplicantSubmitted") {
        onComplete();
      }
    },
    [onComplete],
  );

  return (
    <div className="daimo-flex-1 daimo-min-h-0 daimo-overflow-y-auto">
      <SumsubWebSdk
        accessToken={kycToken}
        expirationHandler={async () => kycToken}
        onMessage={handleMessage}
      />
    </div>
  );
}
