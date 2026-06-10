import { useCallback, useEffect, useRef, useState } from "react";

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
import { CenteredContent, PageHeader, TextInput } from "../shared.js";

type AccountEnrollmentUpdatePageProps = {
  update: AccountEnrollmentUpdateApplePayEnhancedVerification;
  sessionId: string;
  onBack?: (() => void) | null;
  onReady: () => void;
};

type UpgradeInput = {
  ssnLast4: string;
  dateOfBirth: { day: string; month: string; year: string };
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
  const [ssnLast4, setSsnLast4] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState({
    month: "",
    day: "",
    year: "",
  });
  const monthRef = useRef<HTMLInputElement | null>(null);
  const dayRef = useRef<HTMLInputElement | null>(null);
  const yearRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const monthInvalid =
    dateOfBirth.month.length === 2 &&
    !isDatePartInRange(dateOfBirth.month, 1, 12);
  const dayInvalid =
    dateOfBirth.day.length === 2 && !isDatePartInRange(dateOfBirth.day, 1, 31);
  const canSubmit =
    /^\d{4}$/.test(ssnLast4) && parseDateInput(dateOfBirth) != null;
  const description =
    status === "retry"
      ? "We couldn't verify those details. Check them and try again."
      : "We need a few more details before Apple Pay can continue.";

  const submit = useCallback(() => {
    const parsedDate = parseDateInput(dateOfBirth);
    if (!/^\d{4}$/.test(ssnLast4) || !parsedDate) {
      setLocalError(
        "enter the last 4 digits of your SSN and a valid date of birth",
      );
      return;
    }

    const request = { ssnLast4, dateOfBirth: parsedDate };
    setSsnLast4("");
    setDateOfBirth({ month: "", day: "", year: "" });
    setLocalError(null);
    void onSubmit(request);
  }, [dateOfBirth, onSubmit, ssnLast4]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") submit();
    },
    [submit],
  );
  const focusNextWhenFilled = (
    nextRef: React.RefObject<HTMLInputElement | null>,
    value: string,
    length: number,
    isValid = true,
  ) => {
    if (value.length === length && isValid) nextRef.current?.focus();
  };
  const focusPreviousOnEmptyBackspace = (
    event: React.KeyboardEvent<HTMLInputElement>,
    previousRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (event.key === "Backspace" && event.currentTarget.value === "") {
      previousRef.current?.focus();
    }
  };

  return (
    <>
      <CenteredContent>
        <div className="daimo-flex daimo-w-full daimo-max-w-xs daimo-flex-col daimo-gap-4">
          <p className="daimo-text-center daimo-text-sm daimo-leading-relaxed daimo-text-[var(--daimo-text-secondary)]">
            {description}
          </p>

          <div className="daimo-flex daimo-flex-col daimo-gap-3">
            <label className="daimo-flex daimo-flex-col daimo-gap-1.5">
              <span className="daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text-secondary)]">
                SSN last 4
              </span>
              <TextInput
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]*"
                maxLength={4}
                value={ssnLast4}
                onChange={(event) => {
                  const value = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4);
                  setSsnLast4(value);
                  focusNextWhenFilled(monthRef, value, 4);
                }}
                onKeyDown={handleKeyDown}
                placeholder="1234"
                className="daimo-px-4 daimo-py-3"
              />
            </label>

            <label className="daimo-flex daimo-flex-col daimo-gap-1.5">
              <span className="daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text-secondary)]">
                Date of birth
              </span>
              <div className="daimo-grid daimo-w-full daimo-min-w-0 daimo-grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)] daimo-gap-2">
                <TextInput
                  ref={monthRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-month"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={dateOfBirth.month}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 2);
                    setDateOfBirth((current) => ({
                      ...current,
                      month: value,
                    }));
                    focusNextWhenFilled(
                      dayRef,
                      value,
                      2,
                      isDatePartInRange(value, 1, 12),
                    );
                  }}
                  onKeyDown={(event) => {
                    handleKeyDown(event);
                  }}
                  placeholder="MM"
                  aria-label="birth month"
                  aria-invalid={monthInvalid}
                  className={`daimo-h-12 daimo-px-2 daimo-py-3 daimo-text-center ${
                    monthInvalid
                      ? "daimo-ring-1 daimo-ring-[var(--daimo-error)]"
                      : ""
                  }`}
                />
                <TextInput
                  ref={dayRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-day"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={dateOfBirth.day}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 2);
                    setDateOfBirth((current) => ({
                      ...current,
                      day: value,
                    }));
                    focusNextWhenFilled(
                      yearRef,
                      value,
                      2,
                      isDatePartInRange(value, 1, 31),
                    );
                  }}
                  onKeyDown={(event) => {
                    focusPreviousOnEmptyBackspace(event, monthRef);
                    handleKeyDown(event);
                  }}
                  placeholder="DD"
                  aria-label="birth day"
                  aria-invalid={dayInvalid}
                  className={`daimo-h-12 daimo-px-2 daimo-py-3 daimo-text-center ${
                    dayInvalid
                      ? "daimo-ring-1 daimo-ring-[var(--daimo-error)]"
                      : ""
                  }`}
                />
                <TextInput
                  ref={yearRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday-year"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={dateOfBirth.year}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4);
                    setDateOfBirth((current) => ({
                      ...current,
                      year: value,
                    }));
                  }}
                  onKeyDown={(event) => {
                    focusPreviousOnEmptyBackspace(event, dayRef);
                    handleKeyDown(event);
                  }}
                  placeholder="YYYY"
                  aria-label="birth year"
                  className="daimo-h-12 daimo-px-2 daimo-py-3 daimo-text-center"
                />
              </div>
            </label>
          </div>

          {(localError || error) && (
            <p className="daimo-text-center daimo-text-xs daimo-text-[var(--daimo-error)]">
              {localError ?? error}
            </p>
          )}
        </div>
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton onClick={submit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Checking" : "Submit"}
        </PrimaryButton>
      </div>
    </>
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
  icon?: React.ReactNode;
  action?: React.ReactNode;
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

function parseDateInput(value: {
  day: string;
  month: string;
  year: string;
}): { day: string; month: string; year: string } | null {
  if (!/^\d{1,2}$/.test(value.month)) return null;
  if (!/^\d{1,2}$/.test(value.day)) return null;
  if (!/^\d{4}$/.test(value.year)) return null;
  if (!isDatePartInRange(value.month, 1, 12)) return null;
  if (!isDatePartInRange(value.day, 1, 31)) return null;
  const month = value.month.padStart(2, "0");
  const day = value.day.padStart(2, "0");
  const year = value.year;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return { day, month, year };
}

function isDatePartInRange(value: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(value)) return false;
  const num = Number(value);
  return num >= min && num <= max;
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
