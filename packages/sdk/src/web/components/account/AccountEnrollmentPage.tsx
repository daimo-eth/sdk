import SumsubWebSdk from "@sumsub/websdk-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  AccountLegalName,
  EnrollmentResponse,
} from "../../../common/account.js";
import type { NavNodeFiat } from "../../api/navTree.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import type { DaimoPlatform } from "../../platform.js";
import { isDesktop } from "../../platform.js";
import {
  ExternalLinkIcon,
  PrimaryButton,
  SecondaryButton,
} from "../buttons.js";
import { ErrorPage } from "../ErrorPage.js";
import { CheckIcon, ErrorIcon } from "../icons.js";
import { Skeleton, SkeletonText } from "../Skeleton.js";
import {
  CenteredContent,
  ContactSupportButton,
  PageHeader,
  TextInput,
} from "../shared.js";
import {
  AccountKycInfoPage,
  AccountKycInfoSkeleton,
} from "./AccountKycInfoPage.js";
import { getKycRequirement, KycIndicator } from "./kycRequirement.js";

type AccountEnrollmentPageProps = {
  node: NavNodeFiat;
  sessionId: string;
  platform: DaimoPlatform;
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
  "hosted_kyc_required",
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
  "hosted_kyc_required",
  "provider_pending",
  "phone_required",
  "active",
  "suspended",
  "error",
]);
export function AccountEnrollmentPage({
  node,
  sessionId,
  platform,
  onBack,
  onReady,
  onPhoneRequired,
}: AccountEnrollmentPageProps) {
  const rail = node.fiatMethod;
  const requiresLegalNameBeforeEnrollment = rail === "ach" || rail === "sepa";
  const account = useAccountFlow();
  const client = useDaimoClient();
  const [response, setResponse] = useState<EnrollmentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kycAccepted, setKycAccepted] = useState(false);
  const [hostedKycAccepted, setHostedKycAccepted] = useState(false);
  const [legalName, setLegalName] = useState<AccountLegalName | null>(null);
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
      result = await account.startEnrollment(client, {
        rail,
        ...(legalName ? { legalName } : {}),
      });
    } catch (err) {
      console.error("[enrollment] fetch failed:", err);
      if (awaitingWebhook.current) return;
      result = { action: "error", message: t.errorGeneric, retryable: true };
    }

    if (isInitial) setIsLoading(false);
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
    } else {
      responseRef.current = result;
      setResponse(result);
    }
  }, [account, client, legalName, rail, onReady, onPhoneRequired]);

  /** Called when SumSub reports docs submitted. Optimistically show review. */
  const handleKycSubmitted = useCallback(() => {
    awaitingWebhook.current = true;
    responseRef.current = { action: "kyc_pending_review" };
    setResponse({ action: "kyc_pending_review" });
  }, []);

  // Initial fetch
  useEffect(() => {
    if (started.current) return;
    if (requiresLegalNameBeforeEnrollment && legalName == null) return;
    started.current = true;
    fetchEnrollment();
  }, [requiresLegalNameBeforeEnrollment, fetchEnrollment, legalName]);

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

  if (requiresLegalNameBeforeEnrollment && legalName == null) {
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
      <AccountLegalNamePage
        onBack={() => setKycAccepted(false)}
        onSubmit={(name) => {
          setLegalName(name);
          setHostedKycAccepted(true);
        }}
      />
    );
  }

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
        <EnrollmentReviewSubmitted
          title={t.accountEnrollmentPending}
          message={t.accountEnrollmentPendingDesc}
          onBack={onBack}
        />
      );

    case "hosted_kyc_required":
      if (
        !hostedKycAccepted &&
        !(requiresLegalNameBeforeEnrollment && legalName)
      ) {
        return (
          <AccountKycInfoPage
            node={node}
            onContinue={() => setHostedKycAccepted(true)}
            onBack={onBack}
          />
        );
      }
      return (
        <HostedEnrollmentPage
          node={node}
          step={response}
          platform={platform}
          onBack={
            requiresLegalNameBeforeEnrollment && legalName
              ? onBack
              : () => setHostedKycAccepted(false)
          }
        />
      );

    case "hosted_agreement_required":
      return (
        <HostedEnrollmentPage
          node={node}
          step={response}
          platform={platform}
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
    default:
      return assertUnreachable(response);
  }
}

// --- Sub-components ---

function AccountLegalNamePage({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (name: AccountLegalName) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const normalizedFirst = firstName.trim();
  const normalizedLast = lastName.trim();
  const canSubmit = normalizedFirst.length > 0 && normalizedLast.length > 0;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit({ firstName: normalizedFirst, lastName: normalizedLast });
  }, [canSubmit, normalizedFirst, normalizedLast, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") submit();
    },
    [submit],
  );

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountLegalNameTitle} onBack={onBack} />

      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-4">
          <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            {t.accountLegalNameDesc}
          </p>

          <div className="daimo-flex daimo-flex-col daimo-gap-3">
            <label className="daimo-flex daimo-flex-col daimo-gap-1.5">
              <span className="daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text-secondary)]">
                {t.accountLegalNameFirst}
              </span>
              <TextInput
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Daimo"
                autoComplete="given-name"
                autoFocus
                className="daimo-px-4 daimo-py-3"
              />
            </label>

            <label className="daimo-flex daimo-flex-col daimo-gap-1.5">
              <span className="daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text-secondary)]">
                {t.accountLegalNameLast}
              </span>
              <TextInput
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Account"
                autoComplete="family-name"
                className="daimo-px-4 daimo-py-3"
              />
            </label>
          </div>
        </div>
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton onClick={submit} disabled={!canSubmit}>
          {t.continue}
        </PrimaryButton>
      </div>
    </div>
  );
}

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
          style={{
            backgroundColor: "var(--daimo-error-badge-bg)",
            boxShadow: "inset 0 0 0 1px var(--daimo-error-badge-ring)",
          }}
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

function EnrollmentReviewSubmitted({
  title,
  message,
  onBack,
}: {
  title: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title="Verification" onBack={onBack} />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-[320px] daimo-flex-col daimo-items-center daimo-gap-5 daimo-px-6 daimo-text-center">
          <div
            className="daimo-flex daimo-h-16 daimo-w-16 daimo-items-center daimo-justify-center daimo-rounded-full"
            style={{ backgroundColor: "var(--daimo-success-light)" }}
            aria-hidden="true"
          >
            <CheckIcon size={34} />
          </div>
          <div className="daimo-flex daimo-flex-col daimo-gap-2">
            <h2 className="daimo-text-xl daimo-font-semibold daimo-text-[var(--daimo-text)]">
              {title}
            </h2>
            <p className="daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
              {message}
            </p>
          </div>
        </div>
      </CenteredContent>
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

/** Hosted enrollment step. Polling drives completion. */
function HostedEnrollmentPage({
  node,
  step,
  platform,
  onBack,
}: {
  node: NavNodeFiat;
  step: Extract<
    EnrollmentResponse,
    { action: "hosted_agreement_required" | "hosted_kyc_required" }
  >;
  platform: DaimoPlatform;
  onBack: () => void;
}) {
  const isKyc = step.action === "hosted_kyc_required";
  const openHostedStep = useCallback(() => {
    openExternalUrl(
      step.url,
      platform,
      externalWindowName(step),
      "width=500,height=760",
    );
  }, [platform, step]);

  return (
    <EnrollmentExternalActionPage
      title={isKyc ? "Verification" : step.title}
      description={externalActionDescription(step, platform)}
      actionLabel={step.openExternalLabel}
      icon={
        isKyc ? (
          <KycIndicator
            requirement={getKycRequirement(node.kycRequirement)}
            size="xl"
            variant="badge"
          />
        ) : null
      }
      onBack={onBack}
      onOpen={openHostedStep}
    />
  );
}

function EnrollmentExternalActionPage({
  title,
  description,
  actionLabel,
  icon,
  onBack,
  onOpen,
}: {
  title: string;
  description: string;
  actionLabel: string;
  icon: ReactNode;
  onBack: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title} onBack={onBack} />

      <CenteredContent>
        {icon}

        <p className="daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs daimo-text-sm daimo-whitespace-pre-line">
          {description}
        </p>

        <PrimaryButton onClick={onOpen} icon={<ExternalLinkIcon size={16} />}>
          {actionLabel}
        </PrimaryButton>
      </CenteredContent>
    </div>
  );
}

function externalActionDescription(
  step: Extract<
    EnrollmentResponse,
    { action: "hosted_agreement_required" | "hosted_kyc_required" }
  >,
  platform: DaimoPlatform,
): string {
  if (step.action === "hosted_kyc_required") {
    return isDesktop(platform)
      ? t.accountHostedKycDesktopDesc
      : t.accountHostedKycMobileDesc;
  }

  const handoff = isDesktop(platform)
    ? t.accountHostedActionDesktopSuffix
    : t.accountHostedActionMobileSuffix;

  return `${step.description} ${handoff}`;
}

function externalWindowName(
  step: Extract<
    EnrollmentResponse,
    { action: "hosted_agreement_required" | "hosted_kyc_required" }
  >,
): string {
  return step.action === "hosted_kyc_required"
    ? "daimo-verification"
    : "daimo-terms";
}

function openExternalUrl(
  url: string,
  platform: DaimoPlatform,
  target: string,
  features: string,
): Window | null {
  if (isDesktop(platform)) {
    return window.open(url, target, features);
  }
  return window.open(url, "_blank");
}

function assertUnreachable(value: never): never {
  throw new Error(`unhandled enrollment response: ${JSON.stringify(value)}`);
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
