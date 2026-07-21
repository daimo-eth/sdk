import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  EnrollmentActionInput,
  EnrollmentInteraction,
  EnrollmentResponse,
  MtPelerinEnrollmentRequest,
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
import { DaimoTextField } from "../formFields.js";
import { CheckIcon, ErrorIcon } from "../icons.js";
import { Skeleton, SkeletonText } from "../Skeleton.js";
import {
  CenteredContent,
  ContactSupportButton,
  PageHeader,
} from "../shared.js";
import {
  AccountOtpCodeEntry,
  type OtpVerifyOutcome,
} from "./AccountOtpCodeEntry.js";
import {
  enrollmentInteractionIdentity,
  enrollmentFormActionInput,
  enrollmentHostedReturnTiming,
  enrollmentNavigationEffect,
  enrollmentPollingDelay,
  type EnrollmentStep,
  isEnrollmentResponseCurrent,
  type LegacyEnrollmentCopy,
  loadEnrollmentStep,
  shouldLoadEnrollmentTarget,
  submitEnrollmentStep,
} from "./enrollmentProtocol.js";
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
  onBack: () => void;
  onReady: () => void;
  onPhoneRequired: () => void;
};

export function AccountEnrollmentPage({
  node,
  ...props
}: AccountEnrollmentPageProps) {
  return node.fiatMethod === "chf" ? (
    <MtPelerinEnrollmentPage node={node} {...props} />
  ) : (
    <GenericAccountEnrollmentPage node={node} {...props} />
  );
}

function GenericAccountEnrollmentPage({
  node,
  sessionId,
  clientSecret,
  platform,
  onBack,
  onReady,
  onPhoneRequired,
}: AccountEnrollmentPageProps) {
  const rail = node.fiatMethod;
  const target = `${sessionId}:${rail}`;
  const account = useAccountFlow();
  const getAccessToken = account?.getAccessToken;
  const client = useDaimoClient();
  const legacyCopy = useMemo(() => getLegacyCopy(platform), [platform]);
  const [step, setStep] = useState<EnrollmentStep | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestRequestRef = useRef(0);
  const targetRef = useRef(target);
  const stepRef = useRef<EnrollmentStep | null>(null);
  const mountedRef = useRef(true);
  const loadedTargetRef = useRef<string | null>(null);
  const onReadyRef = useRef(onReady);
  const onPhoneRequiredRef = useRef(onPhoneRequired);
  targetRef.current = target;
  onReadyRef.current = onReady;
  onPhoneRequiredRef.current = onPhoneRequired;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyStep = useCallback((result: EnrollmentStep) => {
    stepRef.current = result;
    setStep(result);
    setIsLoading(false);
    setErrorMessage(null);

    switch (enrollmentNavigationEffect(result.interaction)) {
      case "ready":
        onReadyRef.current();
        return;
      case "phone":
        onPhoneRequiredRef.current();
        return;
      case "render":
        return;
    }
  }, []);

  const runRequest = useCallback(
    async (
      request: () => Promise<EnrollmentStep>,
      expectedInteraction: string | null,
    ): Promise<EnrollmentStep | null> => {
      const requestId = ++latestRequestRef.current;
      const requestTarget = targetRef.current;

      let result: EnrollmentStep;
      try {
        result = await request();
      } catch {
        if (
          mountedRef.current &&
          isEnrollmentResponseCurrent({
            requestId,
            latestRequestId: latestRequestRef.current,
            requestTarget,
            currentTarget: targetRef.current,
            expectedInteraction,
            currentInteraction: enrollmentInteractionIdentity(stepRef.current),
          })
        ) {
          setIsLoading(false);
          setErrorMessage(t.errorGeneric);
        }
        return null;
      }

      if (
        !mountedRef.current ||
        !isEnrollmentResponseCurrent({
          requestId,
          latestRequestId: latestRequestRef.current,
          requestTarget,
          currentTarget: targetRef.current,
          expectedInteraction,
          currentInteraction: enrollmentInteractionIdentity(stepRef.current),
        })
      ) {
        return null;
      }

      applyStep(result);
      return result;
    },
    [applyStep],
  );

  const refreshEnrollment = useCallback(
    async (expectedInteraction: string | null = null) => {
      if (!getAccessToken) return null;
      return runRequest(async () => {
        const token = await getAccessToken();
        if (!token) throw new Error("not authenticated");
        return loadEnrollmentStep({
          client,
          rail,
          locale: getLocale(),
          auth: { bearerToken: token },
          legacyCopy,
        });
      }, expectedInteraction);
    },
    [client, getAccessToken, legacyCopy, rail, runRequest],
  );

  const submitAction = useCallback(
    async (
      source: EnrollmentStep,
      actionId: string,
      input: EnrollmentActionInput,
    ) => {
      if (!getAccessToken) return null;
      const expectedInteraction = enrollmentInteractionIdentity(source);
      return runRequest(async () => {
        const token = await getAccessToken();
        if (!token) throw new Error("not authenticated");
        return submitEnrollmentStep({
          client,
          rail,
          locale: getLocale(),
          auth: { bearerToken: token },
          step: source,
          actionId,
          input,
          legacyCopy,
        });
      }, expectedInteraction);
    },
    [client, getAccessToken, legacyCopy, rail, runRequest],
  );

  const refreshEnrollmentRef = useRef(refreshEnrollment);
  refreshEnrollmentRef.current = refreshEnrollment;

  useEffect(() => {
    if (
      !shouldLoadEnrollmentTarget({
        loadedTarget: loadedTargetRef.current,
        target,
        canLoad: getAccessToken != null,
      })
    ) {
      return;
    }
    loadedTargetRef.current = target;
    latestRequestRef.current += 1;
    stepRef.current = null;
    setStep(null);
    setErrorMessage(null);
    setIsLoading(true);
    void refreshEnrollmentRef.current();
  }, [getAccessToken, target]);

  useEffect(() => {
    if (!step) return;
    const delayMs = enrollmentPollingDelay(step.interaction);
    if (delayMs == null) return;
    const expectedInteraction = enrollmentInteractionIdentity(step);
    const timeout = window.setTimeout(() => {
      void refreshEnrollmentRef.current(expectedInteraction);
    }, delayMs);
    return () => window.clearTimeout(timeout);
  }, [step]);

  if (isLoading) {
    return (
      <EnrollmentWaiting title={t.loading} label={t.loading} onBack={onBack} />
    );
  }

  if (errorMessage) {
    return (
      <ErrorPage
        message={errorMessage}
        sessionId={sessionId}
        clientSecret={clientSecret}
        retryText={t.tryAgain}
        onRetry={() => void refreshEnrollment()}
      />
    );
  }

  if (!step) return null;
  const interaction = step.interaction;

  switch (interaction.kind) {
    case "form":
      return (
        <AccountEnrollmentFormPage
          key={enrollmentInteractionIdentity(step)}
          interaction={interaction}
          onBack={onBack}
          onSubmit={(actionId, input) => submitAction(step, actionId, input)}
        />
      );
    case "otp":
      return (
        <EnrollmentOtpPage
          key={enrollmentInteractionIdentity(step)}
          interaction={interaction}
          onBack={onBack}
          onSubmit={(actionId, input) => submitAction(step, actionId, input)}
        />
      );
    case "account-phone-verification":
      return <EnrollmentWaiting title={t.accountPhone} onBack={onBack} />;
    case "hosted":
      return (
        <EnrollmentHostedActionPage
          key={enrollmentInteractionIdentity(step)}
          node={node}
          platform={platform}
          url={interaction.url}
          title={interaction.copy.title}
          description={interaction.copy.description}
          actionLabel={interaction.copy.openExternalLabel}
          purpose={interaction.purpose}
          autoSubmitDelayMs={interaction.returnBehavior.autoSubmitDelayMs}
          onBack={onBack}
          onReturn={() =>
            submitAction(step, interaction.returnBehavior.action.id, {
              kind: "continue",
            })
          }
        />
      );
    case "wait":
      return interaction.reason === "review" ? (
        <EnrollmentReviewSubmitted
          title={t.accountEnrollmentPending}
          message={t.accountEnrollmentPendingDesc}
          onBack={onBack}
        />
      ) : (
        <EnrollmentWaiting
          title={t.accountProviderPending}
          label={t.accountProviderPendingDesc}
          onBack={onBack}
        />
      );
    case "retry":
      return interaction.link ? (
        <EnrollmentHostedActionPage
          key={enrollmentInteractionIdentity(step)}
          node={node}
          platform={platform}
          url={interaction.link.url}
          title={interaction.link.copy.title}
          description={`${interaction.reason}\n\n${interaction.link.copy.description}`}
          actionLabel={interaction.link.copy.openExternalLabel}
          purpose="identity-verification"
          onBack={onBack}
          onReturn={() =>
            submitAction(step, interaction.action.id, { kind: "retry" })
          }
        />
      ) : (
        <ErrorPage
          message={interaction.reason}
          sessionId={sessionId}
          clientSecret={clientSecret}
          retryText={t.tryAgain}
          onRetry={() =>
            void submitAction(step, interaction.action.id, { kind: "retry" })
          }
        />
      );
    case "rejection":
      return (
        <EnrollmentTerminal
          title={t.accountEnrollmentRejected}
          message={interaction.reason}
          sessionId={sessionId}
        />
      );
    case "ineligible":
      return (
        <EnrollmentIneligible
          message={interaction.reason}
          sessionId={sessionId}
          onBack={onBack}
        />
      );
    case "suspended":
      return (
        <EnrollmentTerminal
          title={t.accountSuspended}
          message={interaction.reason}
          sessionId={sessionId}
        />
      );
    case "error": {
      const retryAction = interaction.retryAction;
      return (
        <ErrorPage
          message={interaction.message}
          sessionId={sessionId}
          clientSecret={clientSecret}
          retryText={t.tryAgain}
          onRetry={
            interaction.retryable && retryAction
              ? () =>
                  void submitAction(step, retryAction.id, {
                    kind: "retry",
                  })
              : undefined
          }
          hideRetry={!interaction.retryable || !retryAction}
        />
      );
    }
    case "active":
      return null;
  }
}

function MtPelerinEnrollmentPage({
  sessionId,
  clientSecret,
  onBack,
  onReady,
  onPhoneRequired,
}: AccountEnrollmentPageProps) {
  const account = useAccountFlow();
  const client = useDaimoClient();
  const [response, setResponse] = useState<EnrollmentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const applyResult = useCallback(
    (result: EnrollmentResponse) => {
      setResponse(result);
      setIsLoading(false);
      if (result.action === "active") onReady();
      if (result.action === "phone_required") onPhoneRequired();
    },
    [onPhoneRequired, onReady],
  );

  const continueEnrollment = useCallback(
    async (input: MtPelerinEnrollmentRequest) => {
      if (!account || busyRef.current) return;
      busyRef.current = true;
      setIsBusy(true);
      try {
        const token = await account.getAccessToken();
        if (!token) throw new Error("not authenticated");
        let result = await client.account.continueMtPelerinEnrollment(input, {
          bearerToken: token,
        });
        while (result.kind === "signature_required") {
          const signature = await account.signMessage(result.message);
          result = await client.account.continueMtPelerinEnrollment(
            {
              action: "submit_signature",
              signature,
              locale: getLocale(),
            },
            { bearerToken: token },
          );
        }
        applyResult(result.enrollment);
      } catch {
        applyResult({
          action: "error",
          message: "We couldn’t connect your Daimo wallet.",
          retryable: true,
        });
      } finally {
        busyRef.current = false;
        setIsBusy(false);
      }
    },
    [account, applyResult, client],
  );

  const refreshEnrollment = useCallback(async () => {
    if (!account || busyRef.current) return;
    busyRef.current = true;
    try {
      const token = await account.getAccessToken();
      if (!token) throw new Error("not authenticated");
      const result = await client.account.startEnrollment(
        { rail: "chf", locale: getLocale() },
        { bearerToken: token },
      );
      applyResult(result);
    } catch {
      applyResult({
        action: "error",
        message: t.errorGeneric,
        retryable: true,
      });
    } finally {
      busyRef.current = false;
    }
  }, [account, applyResult, client]);

  useEffect(() => {
    void refreshEnrollment();
  }, [refreshEnrollment]);

  useEffect(() => {
    if (response?.action !== "provider_pending") return;
    const interval = window.setInterval(() => {
      void continueEnrollment({ action: "resume", locale: getLocale() });
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [continueEnrollment, response?.action]);

  if (isLoading || isBusy) {
    return (
      <EnrollmentWaiting
        title="Mt Pelerin"
        label="Creating your Mt Pelerin profile…"
        onBack={onBack}
      />
    );
  }

  if (!response) return null;

  switch (response.action) {
    case "provider_account_choice_required":
      return (
        <MtPelerinAccountChoice
          onBack={onBack}
          onChoose={(choice) =>
            continueEnrollment({
              action: "choose_account",
              choice,
              locale: getLocale(),
            })
          }
        />
      );
    case "provider_phone_required":
      return (
        <MtPelerinTextEntry
          title="Sign in to Mt Pelerin"
          description="Enter the phone number on your Mt Pelerin account, including country code."
          inputMode="tel"
          submitLabel="Send SMS code"
          onBack={onBack}
          onSubmit={(phone) =>
            continueEnrollment({ action: "start_phone", phone })
          }
        />
      );
    case "provider_otp_required":
      return (
        <MtPelerinTextEntry
          title={response.copy.title}
          description={response.copy.message}
          inputMode="numeric"
          maxLength={6}
          submitLabel="Verify code"
          onBack={onBack}
          onSubmit={(code) =>
            continueEnrollment({
              action: "submit_otp",
              code,
              locale: getLocale(),
            })
          }
        />
      );
    case "provider_email_required":
      return (
        <MtPelerinTextEntry
          title="Add your email"
          description="Mt Pelerin requires an email before creating a CHF order."
          inputMode="email"
          defaultValue={account?.email ?? ""}
          submitLabel="Continue"
          onBack={onBack}
          onSubmit={(email) =>
            continueEnrollment({
              action: "submit_email",
              email,
              locale: getLocale(),
            })
          }
        />
      );
    case "mtpelerin_kyc":
      return (
        <EnrollmentIneligible
          message={`Identity verification is required. You can lower the amount to ${response.remainingAllowance} CHF while verification is unavailable.`}
          sessionId={sessionId}
          onBack={onBack}
        />
      );
    case "provider_pending":
      return (
        <EnrollmentWaiting
          title={t.accountProviderPending}
          label={t.accountProviderPendingDesc}
          onBack={onBack}
        />
      );
    case "phone_required":
      return <EnrollmentWaiting title={t.accountPhone} onBack={onBack} />;
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
          onRetry={
            response.retryable ? () => void refreshEnrollment() : undefined
          }
          hideRetry={!response.retryable}
        />
      );
    case "active":
      return null;
    default:
      return (
        <ErrorPage
          message={t.errorGeneric}
          sessionId={sessionId}
          clientSecret={clientSecret}
          hideRetry
        />
      );
  }
}

function MtPelerinAccountChoice({
  onBack,
  onChoose,
}: {
  onBack: () => void;
  onChoose: (choice: "existing" | "new") => void;
}) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title="Mt Pelerin" onBack={onBack} />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-3 daimo-px-6 daimo-text-center">
          <h2 className="daimo-text-xl daimo-font-semibold daimo-text-[var(--daimo-text)]">
            Do you already have a Mt Pelerin account?
          </h2>
          <p className="daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            Signing in by SMS lets us reuse your profile and verification,
            making your deposit faster.
          </p>
        </div>
      </CenteredContent>
      <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-3 daimo-px-6 daimo-pb-6">
        <PrimaryButton onClick={() => onChoose("existing")}>
          Yes, sign in
        </PrimaryButton>
        <SecondaryButton onClick={() => onChoose("new")}>
          No, create one
        </SecondaryButton>
      </div>
    </div>
  );
}

function MtPelerinTextEntry({
  title,
  description,
  inputMode,
  defaultValue = "",
  maxLength,
  submitLabel,
  onBack,
  onSubmit,
}: {
  title: string;
  description: string;
  inputMode: "email" | "numeric" | "tel";
  defaultValue?: string;
  maxLength?: number;
  submitLabel: string;
  onBack: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title} onBack={onBack} />
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-4 daimo-px-6">
          <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            {description}
          </p>
          <DaimoTextField
            value={value}
            onChange={(event) => setValue(event.target.value)}
            type={inputMode === "email" ? "email" : "text"}
            inputMode={inputMode}
            maxLength={maxLength}
            autoFocus
            className="daimo-px-4 daimo-py-3"
          />
        </div>
      </CenteredContent>
      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton
          onClick={() => onSubmit(value.trim())}
          disabled={!value.trim()}
        >
          {submitLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}

function AccountEnrollmentFormPage({
  interaction,
  onBack,
  onSubmit,
}: {
  interaction: Extract<EnrollmentInteraction, { kind: "form" }>;
  onBack: () => void;
  onSubmit: EnrollmentActionSubmitter;
}) {
  const submitForm = async (
    values: Record<string, string | boolean>,
  ): Promise<PaginatedEnrollmentFormSubmitResult> => {
    let input: Extract<EnrollmentActionInput, { kind: "form" }>;
    try {
      input = enrollmentFormActionInput(interaction, values);
    } catch {
      return { ok: false, fieldErrors: { _form: t.errorGeneric } };
    }
    const result = await onSubmit(interaction.action.id, input);
    if (!result) {
      return { ok: false, fieldErrors: { _form: t.errorGeneric } };
    }
    if (result.interaction.kind === "form") {
      return {
        ok: false,
        fieldErrors: result.interaction.form.fieldErrors ?? {
          _form: t.errorGeneric,
        },
      };
    }
    return { ok: true };
  };

  return (
    <PaginatedEnrollmentForm
      form={interaction.form}
      onBack={onBack}
      onSubmit={submitForm}
    />
  );
}

function EnrollmentOtpPage({
  interaction,
  onBack,
  onSubmit,
}: {
  interaction: Extract<EnrollmentInteraction, { kind: "otp" }>;
  onBack: () => void;
  onSubmit: EnrollmentActionSubmitter;
}) {
  const handleVerify = async (code: string): Promise<OtpVerifyOutcome> => {
    const result = await onSubmit(interaction.submitAction.id, {
      kind: "otp",
      code,
    });
    if (!result) return { ok: false, msg: t.errorGeneric };
    if (result.interaction.kind === "otp") {
      return {
        ok: false,
        msg: result.interaction.copy.invalidMessage,
      };
    }
    return { ok: true };
  };

  const handleResend = async () => {
    await onSubmit(interaction.resend.action.id, { kind: "resend-otp" });
  };

  return (
    <AccountOtpCodeEntry
      destination={interaction.destination}
      title={interaction.copy.title}
      message={interaction.copy.message}
      invalidMessage={interaction.copy.invalidMessage}
      resendDelayMs={interaction.resend.delayMs}
      onBack={onBack}
      onVerified={() => undefined}
      onVerify={handleVerify}
      onResend={handleResend}
    />
  );
}

type EnrollmentActionSubmitter = (
  actionId: string,
  input: EnrollmentActionInput,
) => Promise<EnrollmentStep | null>;

function EnrollmentHostedActionPage({
  node,
  platform,
  url,
  title,
  description,
  actionLabel,
  purpose,
  autoSubmitDelayMs,
  onBack,
  onReturn,
}: {
  node: NavNodeFiat;
  platform: DaimoPlatform;
  url: string;
  title: string;
  description: string;
  actionLabel: string;
  purpose: "identity-verification" | "agreement";
  autoSubmitDelayMs?: number;
  onBack: () => void;
  onReturn: () => Promise<EnrollmentStep | null>;
}) {
  const cleanupRef = useRef<() => void>(() => undefined);
  const returnSubmittedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => () => cleanupRef.current(), []);

  const submitReturn = useCallback(() => {
    if (returnSubmittedRef.current) return;
    returnSubmittedRef.current = true;
    cleanupRef.current();
    setIsSubmitting(true);
    void onReturn().finally(() => setIsSubmitting(false));
  }, [onReturn]);

  const openHostedStep = useCallback(() => {
    cleanupRef.current();
    returnSubmittedRef.current = false;
    openExternalUrl(
      url,
      platform,
      purpose === "agreement" ? "daimo-agreement" : "daimo-verification",
      "width=500,height=760",
    );

    const timing = enrollmentHostedReturnTiming(autoSubmitDelayMs);
    if (timing.kind === "auto") {
      setIsSubmitting(true);
      const timeout = window.setTimeout(submitReturn, timing.delayMs);
      cleanupRef.current = () => window.clearTimeout(timeout);
      return;
    }

    let armed = false;
    const armTimeout = window.setTimeout(() => {
      armed = true;
    }, 0);
    const handleReturn = () => {
      if (!armed || document.visibilityState === "hidden") return;
      submitReturn();
    };
    window.addEventListener("focus", handleReturn);
    window.addEventListener("pageshow", handleReturn);
    document.addEventListener("visibilitychange", handleReturn);
    cleanupRef.current = () => {
      window.clearTimeout(armTimeout);
      window.removeEventListener("focus", handleReturn);
      window.removeEventListener("pageshow", handleReturn);
      document.removeEventListener("visibilitychange", handleReturn);
    };
  }, [autoSubmitDelayMs, platform, purpose, submitReturn, url]);

  return (
    <EnrollmentExternalActionPage
      title={title}
      description={description}
      actionLabel={isSubmitting ? t.loading : actionLabel}
      icon={
        purpose === "identity-verification" ? (
          <KycIndicator
            requirement={getKycRequirement(node.kycRequirement)}
            size="xl"
            variant="badge"
          />
        ) : null
      }
      onBack={onBack}
      onOpen={openHostedStep}
      disabled={isSubmitting}
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
  disabled,
}: {
  title: string;
  description: string;
  actionLabel: string;
  icon: ReactNode;
  onBack: () => void;
  onOpen: () => void;
  disabled: boolean;
}) {
  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title} onBack={onBack} />
      <CenteredContent>
        {icon}
        <p className="daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs daimo-text-sm daimo-whitespace-pre-line">
          {description}
        </p>
        <PrimaryButton
          onClick={onOpen}
          disabled={disabled}
          icon={<ExternalLinkIcon size={16} />}
        >
          {actionLabel}
        </PrimaryButton>
      </CenteredContent>
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
          aria-live="polite"
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

function getLegacyCopy(platform: DaimoPlatform): LegacyEnrollmentCopy {
  return {
    verification: {
      title: t.accountHostedKycTitle,
      description: isDesktop(platform)
        ? t.accountHostedKycDesktopDesc
        : t.accountHostedKycMobileDesc,
      openExternalLabel: t.accountHostedKycCta,
    },
    liveness: {
      title: t.accountHostedLivenessTitle,
      description: t.accountHostedLivenessDesc,
      openExternalLabel: t.accountHostedLivenessCta,
    },
  };
}

function openExternalUrl(
  url: string,
  platform: DaimoPlatform,
  target: string,
  features: string,
): Window | null {
  if (isDesktop(platform)) return window.open(url, target, features);
  return window.open(url, "_blank");
}
