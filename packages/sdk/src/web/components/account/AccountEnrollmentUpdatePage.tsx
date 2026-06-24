import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
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
import { DaimoFormField, DaimoTextField } from "../formFields.js";
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
  const monthRef = useRef<HTMLInputElement | null>(null);
  const dayRef = useRef<HTMLInputElement | null>(null);
  const yearRef = useRef<HTMLInputElement | null>(null);
  const ssnLast4 = watch("ssnLast4");
  const month = watch("dateOfBirth.month");
  const day = watch("dateOfBirth.day");
  const year = watch("dateOfBirth.year");
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

  const focusNextWhenFilled = (
    nextRef: RefObject<HTMLInputElement | null>,
    value: string,
    length: number,
    isValid = true,
  ) => {
    if (value.length === length && isValid) nextRef.current?.focus();
  };
  const focusPreviousOnEmptyBackspace = (
    event: KeyboardEvent<HTMLInputElement>,
    previousRef: RefObject<HTMLInputElement | null>,
  ) => {
    if (event.key === "Backspace" && event.currentTarget.value === "") {
      previousRef.current?.focus();
    }
  };
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
  const handleDatePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = digitsOnly(event.clipboardData.getData("text"), 8);
    if (pasted.length < 3) return;
    event.preventDefault();
    setDatePart("dateOfBirth.month", pasted.slice(0, 2));
    setDatePart("dateOfBirth.day", pasted.slice(2, 4));
    setDatePart("dateOfBirth.year", pasted.slice(4, 8));
    if (pasted.length >= 5) {
      yearRef.current?.focus();
    } else {
      dayRef.current?.focus();
    }
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
                    focusNextWhenFilled(monthRef, value, 4);
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
              <div className="daimo-grid daimo-w-full daimo-min-w-0 daimo-grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)] daimo-gap-2">
                <DaimoTextField
                  ref={(input) => {
                    monthField.ref(input);
                    monthRef.current = input;
                  }}
                  id={id}
                  name={monthField.name}
                  onBlur={monthField.onBlur}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-month"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={month}
                  onChange={(event) => {
                    const value = digitsOnly(event.target.value, 2);
                    setDatePart("dateOfBirth.month", value);
                    focusNextWhenFilled(
                      dayRef,
                      value,
                      2,
                      isDatePartInRange(value, 1, 12),
                    );
                  }}
                  onPaste={handleDatePaste}
                  placeholder="MM"
                  aria-label="birth month"
                  aria-describedby={describedBy}
                  aria-invalid={monthInvalid}
                  invalid={monthInvalid}
                  className="daimo-h-12 daimo-px-2 daimo-py-3 daimo-text-center"
                />
                <DaimoTextField
                  ref={(input) => {
                    dayField.ref(input);
                    dayRef.current = input;
                  }}
                  name={dayField.name}
                  onBlur={dayField.onBlur}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-day"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={day}
                  onChange={(event) => {
                    const value = digitsOnly(event.target.value, 2);
                    setDatePart("dateOfBirth.day", value);
                    focusNextWhenFilled(
                      yearRef,
                      value,
                      2,
                      isDatePartInRange(value, 1, 31),
                    );
                  }}
                  onKeyDown={(event) => {
                    focusPreviousOnEmptyBackspace(event, monthRef);
                  }}
                  onPaste={handleDatePaste}
                  placeholder="DD"
                  aria-label="birth day"
                  aria-describedby={describedBy}
                  aria-invalid={dayInvalid}
                  invalid={dayInvalid}
                  className="daimo-h-12 daimo-px-2 daimo-py-3 daimo-text-center"
                />
                <DaimoTextField
                  ref={(input) => {
                    yearField.ref(input);
                    yearRef.current = input;
                  }}
                  name={yearField.name}
                  onBlur={yearField.onBlur}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-year"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={year}
                  onChange={(event) => {
                    setDatePart(
                      "dateOfBirth.year",
                      digitsOnly(event.target.value, 4),
                    );
                  }}
                  onKeyDown={(event) => {
                    focusPreviousOnEmptyBackspace(event, dayRef);
                  }}
                  onPaste={handleDatePaste}
                  placeholder="YYYY"
                  aria-label="birth year"
                  aria-describedby={describedBy}
                  className="daimo-h-12 daimo-px-2 daimo-py-3 daimo-text-center"
                />
              </div>
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
