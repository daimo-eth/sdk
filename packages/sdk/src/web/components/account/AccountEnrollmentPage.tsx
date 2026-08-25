import {
  type FormEvent,
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
} from "../../../common/account.js";
import { DaimoRequestError } from "../../../common/errors.js";
import type { NavNodeFiat } from "../../api/navTree.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { getLocale, t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { useResendCooldown } from "../../hooks/useResendCooldown.js";
import type { DaimoPlatform } from "../../platform.js";
import { isDesktop } from "../../platform.js";
import {
  ExternalLinkIcon,
  PrimaryButton,
  SecondaryButton,
} from "../buttons.js";
import { ErrorPage } from "../ErrorPage.js";
import { DaimoFormField, DaimoTextField } from "../formFields.js";
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
  retryEnrollmentRefresh,
  shouldLoadEnrollmentTarget,
  submitEnrollmentStep,
} from "./enrollmentProtocol.js";
import { runAccountSessionRecreateOnce } from "./accountSessionRecreate.js";
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
  onLogout: () => Promise<void>;
};

type EnrollmentRequestError = {
  error: unknown;
  stage: "enrollment_refresh" | "enrollment_action";
};

export function AccountEnrollmentPage({
  node,
  sessionId,
  clientSecret,
  platform,
  onBack,
  onReady,
  onPhoneRequired,
  onLogout,
}: AccountEnrollmentPageProps) {
  const rail = node.fiatMethod;
  const target = `${sessionId}:${rail}`;
  const account = useAccountFlow();
  const getAccessToken = account?.getAccessToken;
  const client = useDaimoClient();
  const legacyCopy = useMemo(() => getLegacyCopy(platform), [platform]);
  const [step, setStep] = useState<EnrollmentStep | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requestError, setRequestError] =
    useState<EnrollmentRequestError | null>(null);
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
    setRequestError(null);

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
      errorStage: EnrollmentRequestError["stage"],
    ): Promise<EnrollmentStep | null> => {
      const requestId = ++latestRequestRef.current;
      const requestTarget = targetRef.current;

      let result: EnrollmentStep;
      try {
        result = await request();
      } catch (error) {
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
          setRequestError({
            error: error ?? new Error("unknown enrollment request error"),
            stage: errorStage,
          });
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
      return runRequest(
        () =>
          retryEnrollmentRefresh(async () => {
            const token = await getAccessToken();
            if (!token) throw new Error("not authenticated");
            return loadEnrollmentStep({
              client,
              rail,
              locale: getLocale(),
              auth: { bearerToken: token },
              legacyCopy,
            });
          }),
        expectedInteraction,
        "enrollment_refresh",
      );
    },
    [client, getAccessToken, legacyCopy, rail, runRequest],
  );

  const retryEnrollment = useCallback(() => {
    if (!getAccessToken) return;
    setRequestError(null);
    setIsLoading(true);
    void refreshEnrollment();
  }, [getAccessToken, refreshEnrollment]);

  const submitAction = useCallback(
    async (
      source: EnrollmentStep,
      actionId: string,
      input: EnrollmentActionInput,
    ) => {
      if (!getAccessToken) return null;
      const expectedInteraction = enrollmentInteractionIdentity(source);
      return runRequest(
        async () => {
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
        },
        expectedInteraction,
        "enrollment_action",
      );
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
    setRequestError(null);
    setIsLoading(true);
    void refreshEnrollmentRef.current();
  }, [getAccessToken, target]);

  useEffect(() => {
    if (isLoading || requestError || !step) return;
    const delayMs = enrollmentPollingDelay(step.interaction);
    if (delayMs == null) return;
    const expectedInteraction = enrollmentInteractionIdentity(step);
    const timeout = window.setTimeout(() => {
      void refreshEnrollmentRef.current(expectedInteraction);
    }, delayMs);
    return () => window.clearTimeout(timeout);
  }, [isLoading, requestError, step]);

  if (isLoading) {
    return (
      <EnrollmentWaiting title={t.loading} label={t.loading} onBack={onBack} />
    );
  }

  if (requestError) {
    return (
      <ErrorPage
        message={t.errorGeneric}
        eventError={requestError.error}
        errorCode={enrollmentRequestErrorCode(requestError.error)}
        errorStage={requestError.stage}
        onBack={onBack}
        sessionId={sessionId}
        clientSecret={clientSecret}
        retryText={t.tryAgain}
        onRetry={retryEnrollment}
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
    case "code":
      return (
        <EnrollmentCodePage
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
          onBack={onBack}
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
          onBack={onBack}
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
    case "account-email-change":
      return (
        <EnrollmentEmailChangePage
          email={account?.email ?? ""}
          onBack={onBack}
          onUseAnotherEmail={onLogout}
        />
      );
    case "active":
      return null;
  }
}

function enrollmentRequestErrorCode(error: unknown): string | undefined {
  if (!(error instanceof DaimoRequestError)) return undefined;
  return error.code ?? (error.status > 0 ? String(error.status) : undefined);
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

export function EnrollmentCodePage({
  interaction,
  onBack,
  onSubmit,
}: {
  interaction: Extract<EnrollmentInteraction, { kind: "code" }>;
  onBack: () => void;
  onSubmit: EnrollmentActionSubmitter;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(interaction.error);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { canResend, restart: restartResendCooldown } =
    useResendCooldown(interaction.resend.delayMs);
  const actionInFlightRef = useRef(false);
  const normalizedCode = code.trim();
  const isValid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedCode,
    );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) {
      setError(interaction.copy.invalidMessage);
      return;
    }
    if (isSubmitting || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError(undefined);
    setIsSubmitting(true);
    const result = await onSubmit(interaction.submitAction.id, {
      kind: "code",
      code: normalizedCode,
    });
    if (result?.interaction.kind === "code") {
      actionInFlightRef.current = false;
      setError(result.interaction.error ?? interaction.copy.invalidMessage);
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isSubmitting || !canResend || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setError(undefined);
    setIsSubmitting(true);
    const result = await onSubmit(interaction.resend.action.id, {
      kind: "resend-code",
    });
    if (result?.interaction.kind === "code") {
      actionInFlightRef.current = false;
      restartResendCooldown();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={interaction.copy.title} onBack={onBack} />
      <form
        className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
        onSubmit={handleSubmit}
      >
        <CenteredContent>
          <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs">
            {interaction.copy.message}
          </p>
          <div className="daimo-w-full daimo-max-w-sm">
            <DaimoFormField label={interaction.copy.inputLabel} error={error}>
              {({ id, describedBy, invalid }) => (
                <DaimoTextField
                  id={id}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  autoFocus
                  className="daimo-px-4 daimo-py-3 daimo-text-base daimo-font-mono"
                />
              )}
            </DaimoFormField>
          </div>
        </CenteredContent>
        <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center daimo-gap-2">
          <PrimaryButton type="submit" disabled={!isValid || isSubmitting}>
            {interaction.copy.submitLabel}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            onClick={() => void handleResend()}
            disabled={isSubmitting || !canResend}
          >
            {interaction.copy.resendLabel}
          </SecondaryButton>
        </div>
      </form>
    </div>
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

function WarningGlyph({ neutral = false }: { neutral?: boolean }) {
  return (
    <div
      className="daimo-flex daimo-h-16 daimo-w-16 daimo-items-center daimo-justify-center daimo-rounded-full daimo-text-[var(--daimo-text)]"
      style={{
        backgroundColor: neutral
          ? "var(--daimo-surface-secondary)"
          : "var(--daimo-warning-light, var(--daimo-surface-secondary))",
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
        style={neutral ? undefined : { color: "var(--daimo-warning, #f59e0b)" }}
        aria-hidden="true"
      >
        <path d="M12 3 2.8 19a1 1 0 0 0 .87 1.5h16.66A1 1 0 0 0 21.2 19z" />
        <path d="M12 9v4.5" />
        <path d="M12 17h.01" />
      </svg>
    </div>
  );
}

export function EnrollmentEmailChangePage({
  email,
  onBack,
  onUseAnotherEmail,
}: {
  email: string;
  onBack: () => void;
  onUseAnotherEmail: () => Promise<void>;
}) {
  const logoutState = useRef({ current: null as Promise<void> | null });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const message = t.accountEmailChangeMessage(email);

  const handleUseAnotherEmail = async () => {
    setLogoutFailed(false);
    setIsLoggingOut(true);
    try {
      await runAccountSessionRecreateOnce(
        logoutState.current,
        onUseAnotherEmail,
      );
    } catch {
      setLogoutFailed(true);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountEnrollment} onBack={onBack} />
      <CenteredContent>
        <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-4 daimo-px-6 daimo-text-center">
          <WarningGlyph neutral />
          <p className="daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            <span>
              {message.beforeEmail}
              <strong className="daimo-font-semibold daimo-text-[var(--daimo-text)]">
                {message.email}
              </strong>
              {message.afterEmail}
            </span>
            <br />
            <span>{message.reason}</span>
          </p>
          {logoutFailed ? (
            <p className="daimo-text-sm daimo-text-[var(--daimo-error)]">
              {t.accountLogoutFailed}
            </p>
          ) : null}
        </div>
      </CenteredContent>
      <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-3 daimo-px-6 daimo-pb-6">
        <PrimaryButton
          onClick={() => void handleUseAnotherEmail()}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? t.loading : t.accountEmailChangeCta}
        </PrimaryButton>
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
          <WarningGlyph />
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
