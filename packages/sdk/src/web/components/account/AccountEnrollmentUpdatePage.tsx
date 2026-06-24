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
  AccountEnrollmentUpdate,
  AccountEnrollmentUpdateApplePayEnhancedVerification,
  ApplePayEnhancedVerificationStatus,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { formatUserError } from "../../hooks/formatUserError.js";
import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { PrimaryButton, SecondaryLinkButton } from "../buttons.js";
import {
  DaimoFormField,
  DaimoSegmentedNumberField,
  DaimoTextField,
} from "../formFields.js";
import { CenteredContent, PageHeader } from "../shared.js";
import {
  type ApplePayVerificationFormValues,
  type ApplePayVerificationSubmitValues,
  digitsOnly,
  isDatePartInRange,
  zApplePayVerificationForm,
} from "./formSchemas.js";

type AccountEnrollmentUpdatePageProps = {
  update: AccountEnrollmentUpdateApplePayEnhancedVerification;
  sessionId: string;
  onBack?: (() => void) | null;
  onReady: () => void;
};

type UpgradeInput = ApplePayVerificationSubmitValues;

const applePayVerificationDefaults: ApplePayVerificationFormValues = {
  ssnLast4: "",
  dateOfBirth: { month: "", day: "", year: "" },
};

export function AccountEnrollmentUpdatePage({
  update: initialUpdate,
  sessionId,
  onBack,
  onReady,
}: AccountEnrollmentUpdatePageProps) {
  const account = useAccountFlow();
  const client = useDaimoClient();
  const [update, setUpdate] = useState(initialUpdate);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!account) throw new Error("account flow missing");
    const token = await account.getAccessToken();
    if (!token) throw new Error("not authenticated");
    const result = await client.account.getEnrollmentUpdate({
      bearerToken: token,
    });
    setUpdate(requireApplePayEnhancedVerification(result));
    if (result.status === "complete") onReady();
  }, [account, client, onReady]);

  useEffect(() => {
    void refresh().catch((err) => {
      setError(formatUserError(err, "failed to check limits"));
    });
  }, [refresh]);

  useEffect(() => {
    if (update.status !== "pending") return;
    const interval = window.setInterval(() => {
      void refresh().catch((err) => {
        setError(formatUserError(err, "failed to check limits"));
      });
    }, 2000);
    return () => window.clearInterval(interval);
  }, [update.status, refresh]);

  const submit = useCallback(
    async (input: UpgradeInput) => {
      if (!account) throw new Error("account flow missing");
      setIsSubmitting(true);
      setError(null);
      try {
        const token = await account.getAccessToken();
        if (!token) throw new Error("not authenticated");
        const result = await client.account.submitEnrollmentUpdate(
          {
            type: "apple_pay_enhanced_verification",
            rail: "apple_pay",
            ...input,
          },
          { bearerToken: token },
        );
        setUpdate(requireApplePayEnhancedVerification(result));
        if (result.status === "complete") onReady();
      } catch (err) {
        setError(
          formatUserError(
            err,
            "couldn't verify your details. please try again.",
          ),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, client, onReady],
  );

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title="Increase Apple Pay limits" onBack={onBack} />

      <EnrollmentUpdateContent
        update={update}
        sessionId={sessionId}
        email={account?.email}
        error={error}
        isSubmitting={isSubmitting}
        onSubmit={submit}
      />
    </div>
  );
}

function EnrollmentUpdateContent({
  update,
  sessionId,
  email,
  error,
  isSubmitting,
  onSubmit,
}: {
  update: AccountEnrollmentUpdateApplePayEnhancedVerification;
  sessionId: string;
  email?: string;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (input: UpgradeInput) => Promise<void>;
}) {
  switch (update.status) {
    case "pending":
      return (
        <EnrollmentUpdateMessage
          title="Checking your limits"
          description="We're checking your update. This usually takes a few seconds."
          error={error}
          icon={<Spinner />}
        />
      );
    case "complete":
      return (
        <EnrollmentUpdateMessage
          title="Limits increased"
          description="Your Apple Pay limits are updated."
        />
      );
    case "unavailable":
      return (
        <EnrollmentUpdateUnavailable
          sessionId={sessionId}
          email={email}
          error={error}
        />
      );
    case "required":
    case "retry":
      if (update.fields.length === 0) {
        return (
          <EnrollmentUpdateUnavailable
            sessionId={sessionId}
            email={email}
            error={error}
          />
        );
      }
      return (
        <EnrollmentUpdateForm
          status={update.status}
          error={error}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
        />
      );
    default:
      return assertUnreachable(update.status);
  }
}

function EnrollmentUpdateForm({
  status,
  error,
  isSubmitting,
  onSubmit,
}: {
  status: ApplePayEnhancedVerificationStatus;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (input: UpgradeInput) => Promise<void>;
}) {
  const {
    formState: { errors, isValid },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<
    ApplePayVerificationFormValues,
    unknown,
    ApplePayVerificationSubmitValues
  >({
    resolver: zodResolver(zApplePayVerificationForm),
    mode: "onChange",
    defaultValues: applePayVerificationDefaults,
  });
  const ssnLast4 = watch("ssnLast4");
  const month = watch("dateOfBirth.month");
  const day = watch("dateOfBirth.day");
  const year = watch("dateOfBirth.year");
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const ssnField = register("ssnLast4");
  const monthField = register("dateOfBirth.month");
  const dayField = register("dateOfBirth.day");
  const yearField = register("dateOfBirth.year");
  const monthInvalid =
    month.length === 2 && !isDatePartInRange(month, 1, 12);
  const dayInvalid = day.length === 2 && !isDatePartInRange(day, 1, 31);
  const dateError = errors.dateOfBirth?.month?.message;
  const description =
    status === "retry"
      ? "We couldn't verify those details. Check them and try again."
      : "We need a few more details before Apple Pay can continue.";

  const submit = handleSubmit(
    useCallback(
      async (input) => {
        await onSubmit(input);
        reset(applePayVerificationDefaults);
      },
      [onSubmit, reset],
    ),
  );

  const setDatePart = (
    name:
      | "dateOfBirth.month"
      | "dateOfBirth.day"
      | "dateOfBirth.year"
      | "ssnLast4",
    value: string,
  ) => {
    setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  return (
    <form
      className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-4">
          <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            {description}
          </p>

          <div className="daimo-flex daimo-flex-col daimo-gap-3">
            <DaimoFormField
              label="SSN last 4"
              error={errors.ssnLast4?.message}
            >
              {({ id, describedBy, invalid }) => (
                <DaimoTextField
                  ref={ssnField.ref}
                  id={id}
                  name={ssnField.name}
                  onBlur={ssnField.onBlur}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  pattern="[0-9]*"
                  maxLength={4}
                  value={ssnLast4}
                  onChange={(event) => {
                    const value = digitsOnly(event.target.value, 4);
                    setDatePart("ssnLast4", value);
                    if (value.length === 4) monthInputRef.current?.focus();
                  }}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  placeholder="1234"
                  className="daimo-px-4 daimo-py-3"
                />
              )}
            </DaimoFormField>

            <DaimoFormField label="Date of birth" error={dateError}>
              {({ id, describedBy }) => (
                <DaimoSegmentedNumberField
                  describedBy={describedBy}
                  segments={[
                    {
                      inputRef: (input) => {
                        monthField.ref(input);
                        monthInputRef.current = input;
                      },
                      id,
                      name: monthField.name,
                      onBlur: monthField.onBlur,
                      autoComplete: "bday-month",
                      value: month,
                      maxLength: 2,
                      placeholder: "MM",
                      ariaLabel: "birth month",
                      invalid: monthInvalid,
                      onValueChange: (value) =>
                        setDatePart("dateOfBirth.month", value),
                      canAutoAdvance: (value) =>
                        isDatePartInRange(value, 1, 12),
                    },
                    {
                      inputRef: dayField.ref,
                      name: dayField.name,
                      onBlur: dayField.onBlur,
                      autoComplete: "bday-day",
                      value: day,
                      maxLength: 2,
                      placeholder: "DD",
                      ariaLabel: "birth day",
                      invalid: dayInvalid,
                      onValueChange: (value) =>
                        setDatePart("dateOfBirth.day", value),
                      canAutoAdvance: (value) =>
                        isDatePartInRange(value, 1, 31),
                    },
                    {
                      inputRef: yearField.ref,
                      name: yearField.name,
                      onBlur: yearField.onBlur,
                      autoComplete: "bday-year",
                      value: year,
                      maxLength: 4,
                      placeholder: "YYYY",
                      ariaLabel: "birth year",
                      width: "minmax(0, 1.35fr)",
                      onValueChange: (value) =>
                        setDatePart("dateOfBirth.year", value),
                    },
                  ]}
                />
              )}
            </DaimoFormField>
          </div>

          {error && (
            <p className="daimo-text-center daimo-text-xs daimo-text-[var(--daimo-error)]">
              {error}
            </p>
          )}
        </div>
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? "Checking" : "Submit"}
        </PrimaryButton>
      </div>
    </form>
  );
}

function EnrollmentUpdateUnavailable({
  sessionId,
  email,
  error,
}: {
  sessionId: string;
  email?: string;
  error: string | null;
}) {
  const subject = "Apple Pay limit increase";
  const href = buildSupportHref({
    subject,
    info: {
      "Session ID": sessionId,
      Email: email,
    },
  });

  return (
    <EnrollmentUpdateMessage
      description="This Apple Pay account is not eligible for a limit increase right now."
      error={error}
      action={
        <SecondaryLinkButton href={href}>
          {t.contactSupport}
        </SecondaryLinkButton>
      }
    />
  );
}

function buildSupportHref({
  subject,
  info,
}: {
  subject: string;
  info: Record<string, string | undefined>;
}) {
  const bodyLines = [
    ...Object.entries(info)
      .filter((entry): entry is [string, string] => entry[1] != null)
      .map(([key, value]) => `${key}: ${value}`),
    "",
    t.tellUsHowWeCanHelp,
  ];
  const body = bodyLines.join("\n");
  return `mailto:support@daimo.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function EnrollmentUpdateMessage({
  title,
  description,
  error,
  icon,
  action,
}: {
  title?: string;
  description: string;
  error?: string | null;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <CenteredContent>
      {icon}
      <div className="daimo-flex daimo-max-w-[320px] daimo-flex-col daimo-gap-2 daimo-text-center">
        {title && (
          <h2 className="daimo-text-lg daimo-font-semibold daimo-text-[var(--daimo-text)]">
            {title}
          </h2>
        )}
        <p className="daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
          {description}
        </p>
      </div>
      {error && (
        <p className="daimo-max-w-[320px] daimo-text-center daimo-text-xs daimo-text-[var(--daimo-error)]">
          {error}
        </p>
      )}
      {action}
    </CenteredContent>
  );
}

function requireApplePayEnhancedVerification(
  update: AccountEnrollmentUpdate,
): AccountEnrollmentUpdateApplePayEnhancedVerification {
  return update;
}

function assertUnreachable(value: never): never {
  throw new Error(`unhandled enrollment update: ${value}`);
}

function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="daimo-animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
