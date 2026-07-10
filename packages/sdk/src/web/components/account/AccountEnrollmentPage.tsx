import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type {
  EnrollmentForm,
  AccountLegalName,
  EnrollmentResponse,
} from "../../../common/account.js";
import type { NavNodeFiat } from "../../api/navTree.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { getLocale, t } from "../../hooks/locale.js";
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
} from "../shared.js";
import { DaimoFormField, DaimoTextField } from "../formFields.js";
import {
  AccountKycInfoPage,
  AccountKycInfoSkeleton,
} from "./AccountKycInfoPage.js";
import { getAccountEnrollmentRequest } from "./accountEnrollmentRequest.js";
import { type LegalNameFormValues, zLegalNameForm } from "./formSchemas.js";
import { getKycRequirement, KycIndicator } from "./kycRequirement.js";
import {
  PaginatedEnrollmentForm,
  type PaginatedEnrollmentFormSubmitResult,
} from "./PaginatedEnrollmentForm.js";

type AccountEnrollmentPageProps = {
  node: NavNodeFiat;
  sessionId: string;
  clientSecret: string;
  platform: DaimoPlatform;
  returnUrl?: string;
  onBack: () => void;
  onReady: () => void;
  /** Called when enrollment requires a phone OTP (e.g. Coinbase Headless). */
  onPhoneRequired: () => void;
  /** Called when enrollment requires a provider-owned OTP. */
  onProviderOtpRequired: () => void;
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

export function AccountEnrollmentPage({
  node,
  sessionId,
  clientSecret,
  platform,
  returnUrl,
  onBack,
  onReady,
  onPhoneRequired,
  onProviderOtpRequired,
}: AccountEnrollmentPageProps) {
  const rail = node.fiatMethod;
  const requiresLegalNameBeforeEnrollment = rail === "ach" || rail === "sepa";
  const account = useAccountFlow();
  const setProviderOtp = account?.setProviderOtp;
  const client = useDaimoClient();
  const [response, setResponse] = useState<EnrollmentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kycAccepted, setKycAccepted] = useState(false);
  const [legalName, setLegalName] = useState<AccountLegalName | null>(null);
  const started = useRef(false);
  const responseRef = useRef<EnrollmentResponse | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);

  const applyEnrollmentResult = useCallback(
    (
      result: EnrollmentResponse,
      previousAction?: EnrollmentResponse["action"],
    ) => {
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
      } else if (result.action === "provider_otp_required") {
        responseRef.current = result;
        setResponse(result);
        setProviderOtp?.(result);
        onProviderOtpRequired();
      } else {
        responseRef.current = result;
        setResponse(result);
      }
    },
    [onReady, onPhoneRequired, onProviderOtpRequired, setProviderOtp],
  );

  const fetchEnrollment = useCallback(async () => {
    if (!account) return;
    const isInitial = responseRef.current == null;
    const previousAction = responseRef.current?.action;
    if (isInitial) setIsLoading(true);

    let result: EnrollmentResponse | null;
    try {
      result = await account.startEnrollment(
        client,
        getAccountEnrollmentRequest({
          rail,
          legalName,
          returnUrl,
        }),
      );
    } catch (err) {
      console.error("[enrollment] fetch failed:", err);
      result = { action: "error", message: t.errorGeneric, retryable: true };
    }

    if (isInitial) setIsLoading(false);
    if (!result) return;
    applyEnrollmentResult(result, previousAction);
  }, [account, applyEnrollmentResult, client, legalName, rail, returnUrl]);

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
        <HostedEnrollmentPage
          node={node}
          step={response}
          platform={platform}
          onBack={() => setKycAccepted(false)}
        />
      );

    case "kyc_retry":
      return (
        <HostedEnrollmentPage
          node={node}
          step={response}
          platform={platform}
          onBack={onBack}
        />
      );

    case "kyc_pending_review":
      return (
        <EnrollmentReviewSubmitted
          title={t.accountEnrollmentPending}
          message={t.accountEnrollmentPendingDesc}
          onBack={onBack}
        />
      );

    case "enrollment_form_required":
      return (
        <AccountEnrollmentFormPage
          form={response.form}
          returnUrl={returnUrl}
          onBack={onBack}
          onSubmitted={(result) =>
            applyEnrollmentResult(result, response.action)
          }
        />
      );

    case "hosted_kyc_required":
      return (
        <HostedEnrollmentPage
          node={node}
          step={response}
          platform={platform}
          onBack={onBack}
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
          clientSecret={clientSecret}
          retryText={t.tryAgain}
          onRetry={response.retryable ? fetchEnrollment : undefined}
          hideRetry={!response.retryable}
        />
      );

    case "phone_required":
      // Navigation is triggered in fetchEnrollment; render a waiting state
      // here to avoid flicker until the modal pushes the phone screen.
      return <PhoneEntrySkeleton onBack={onBack} />;

    case "provider_otp_required":
      return <PhoneEntrySkeleton onBack={onBack} />;

    case "active":
      return null;
    default:
      return assertUnreachable(response);
  }
}

// --- Sub-components ---

function AccountEnrollmentFormPage({
  form,
  returnUrl,
  onBack,
  onSubmitted,
}: {
  form: EnrollmentForm;
  returnUrl?: string;
  onBack: () => void;
  onSubmitted: (response: EnrollmentResponse) => void;
}) {
  const account = useAccountFlow();
  const client = useDaimoClient();

  const submitForm = async (
    values: Record<string, string | boolean>,
  ): Promise<PaginatedEnrollmentFormSubmitResult> => {
    if (!account) {
      return { ok: false, fieldErrors: { _form: t.errorConnectionLost } };
    }
    const token = await account.getAccessToken();
    if (!token) {
      return { ok: false, fieldErrors: { _form: t.errorConnectionLost } };
    }

    try {
      const result = await client.account.submitEnrollmentForm(
        {
          formId: form.id,
          revision: form.revision,
          values,
          locale: getLocale(),
          ...(returnUrl ? { returnUrl } : {}),
        },
        { bearerToken: token },
      );
      onSubmitted(result);
      return { ok: true };
    } catch (err) {
      console.error("[enrollment] form submit failed:", err);
      return { ok: false, fieldErrors: { _form: t.errorGeneric } };
    }
  };

  return (
    <PaginatedEnrollmentForm
      form={form}
      onBack={onBack}
      onSubmit={submitForm}
    />
  );
}

function AccountLegalNamePage({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (name: AccountLegalName) => void;
}) {
  const {
    formState: { errors, isValid },
    handleSubmit,
    register,
  } = useForm<LegalNameFormValues>({
    resolver: zodResolver(zLegalNameForm),
    mode: "onChange",
    defaultValues: { firstName: "", lastName: "" },
  });

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountLegalNameTitle} onBack={onBack} />

      <form
        className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
        onSubmit={handleSubmit(onSubmit)}
      >
        <CenteredContent>
          <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-4">
            <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
              {t.accountLegalNameDesc}
            </p>

            <div className="daimo-flex daimo-flex-col daimo-gap-3">
              <DaimoFormField
                label={t.accountLegalNameFirst}
                error={errors.firstName?.message}
              >
                {({ id, describedBy, invalid }) => (
                  <DaimoTextField
                    {...register("firstName")}
                    id={id}
                    type="text"
                    aria-describedby={describedBy}
                    invalid={invalid}
                    autoComplete="given-name"
                    autoFocus
                    className="daimo-px-4 daimo-py-3"
                  />
                )}
              </DaimoFormField>

              <DaimoFormField
                label={t.accountLegalNameLast}
                error={errors.lastName?.message}
              >
                {({ id, describedBy, invalid }) => (
                  <DaimoTextField
                    {...register("lastName")}
                    id={id}
                    type="text"
                    aria-describedby={describedBy}
                    invalid={invalid}
                    autoComplete="family-name"
                    className="daimo-px-4 daimo-py-3"
                  />
                )}
              </DaimoFormField>
            </div>
          </div>
        </CenteredContent>

        <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
          <PrimaryButton type="submit" disabled={!isValid}>
            {t.continue}
          </PrimaryButton>
        </div>
      </form>
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
              {message || t.accountRegionUnavailableDescription}
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
      <PageHeader title={t.accountHostedKycTitle} onBack={onBack} />
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

type ExternalEnrollmentStep = Extract<
  EnrollmentResponse,
  {
    action:
      | "kyc_required"
      | "kyc_retry"
      | "hosted_agreement_required"
      | "hosted_kyc_required";
  }
>;

/** Hosted enrollment step. Polling drives completion. */
function HostedEnrollmentPage({
  node,
  step,
  platform,
  onBack,
}: {
  node: NavNodeFiat;
  step: ExternalEnrollmentStep;
  platform: DaimoPlatform;
  onBack: () => void;
}) {
  const isKyc = step.action !== "hosted_agreement_required";
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
      title={externalActionTitle(step)}
      description={externalActionDescription(step, platform)}
      actionLabel={externalActionLabel(step)}
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

/** Whether this hosted step is the partner liveness check (vs general KYC). */
function isLivenessStep(step: ExternalEnrollmentStep): boolean {
  return step.action === "hosted_kyc_required";
}

function externalActionTitle(step: ExternalEnrollmentStep): string {
  if (step.title) return step.title;
  return isLivenessStep(step)
    ? t.accountHostedLivenessTitle
    : t.accountHostedKycTitle;
}

function externalActionDescription(
  step: ExternalEnrollmentStep,
  platform: DaimoPlatform,
): string {
  if (step.action === "hosted_agreement_required") {
    const handoff = isDesktop(platform)
      ? t.accountHostedActionDesktopSuffix
      : t.accountHostedActionMobileSuffix;
    return `${step.description} ${handoff}`;
  }

  if (step.description) return step.description;

  const base = isLivenessStep(step)
    ? t.accountHostedLivenessDesc
    : isDesktop(platform)
      ? t.accountHostedKycDesktopDesc
      : t.accountHostedKycMobileDesc;

  if (step.action === "kyc_retry") {
    return `${step.reason}\n\n${base}`;
  }
  return base;
}

function externalActionLabel(step: ExternalEnrollmentStep): string {
  if (step.openExternalLabel) return step.openExternalLabel;
  return isLivenessStep(step)
    ? t.accountHostedLivenessCta
    : t.accountHostedKycCta;
}

function externalWindowName(step: ExternalEnrollmentStep): string {
  return step.action === "hosted_agreement_required"
    ? "daimo-terms"
    : "daimo-verification";
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
