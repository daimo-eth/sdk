import { useCallback, useEffect, useState } from "react";

import type {
  AccountEnrollmentUpdate,
  AccountEnrollmentUpdateApplePayEnhancedVerification,
  ApplePayEnhancedVerificationStatus,
} from "../../../common/account.js";
import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { formatUserError } from "../../hooks/formatUserError.js";
import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { PrimaryButton, SecondaryButton } from "../buttons.js";
import { CenteredContent, PageHeader, TextInput } from "../shared.js";

type AccountEnrollmentUpdatePageProps = {
  update: AccountEnrollmentUpdateApplePayEnhancedVerification;
  onBack?: (() => void) | null;
  onReady: () => void;
};

type UpgradeInput = {
  ssnLast4: string;
  dateOfBirth: { day: string; month: string; year: string };
};

export function AccountEnrollmentUpdatePage({
  update: initialUpdate,
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
          formatUserError(err, "couldn't verify your details. please try again."),
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
        error={error}
        isSubmitting={isSubmitting}
        onSubmit={submit}
        onRetry={refresh}
      />
    </div>
  );
}

function EnrollmentUpdateContent({
  update,
  error,
  isSubmitting,
  onSubmit,
  onRetry,
}: {
  update: AccountEnrollmentUpdateApplePayEnhancedVerification;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (input: UpgradeInput) => Promise<void>;
  onRetry: () => Promise<void>;
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
      return <EnrollmentUpdateUnavailable error={error} onRetry={onRetry} />;
    case "required":
    case "retry":
      if (update.fields.length === 0) {
        return <EnrollmentUpdateUnavailable error={error} onRetry={onRetry} />;
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
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const canSubmit =
    /^\d{4}$/.test(ssnLast4) && parseDateInput(dateOfBirth) != null;
  const description =
    status === "retry"
      ? "We couldn't verify those details. Check them and try again."
      : "We need a few more details before Apple Pay can continue.";

  const submit = useCallback(() => {
    const parsedDate = parseDateInput(dateOfBirth);
    if (!/^\d{4}$/.test(ssnLast4) || !parsedDate) {
      setLocalError("enter the last 4 digits of your SSN and date of birth");
      return;
    }

    const request = { ssnLast4, dateOfBirth: parsedDate };
    setSsnLast4("");
    setDateOfBirth("");
    setLocalError(null);
    void onSubmit(request);
  }, [dateOfBirth, onSubmit, ssnLast4]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") submit();
    },
    [submit],
  );

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
                onChange={(event) =>
                  setSsnLast4(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                onKeyDown={handleKeyDown}
                placeholder="1234"
                className="daimo-px-4 daimo-py-3"
              />
            </label>

            <label className="daimo-flex daimo-flex-col daimo-gap-1.5">
              <span className="daimo-text-xs daimo-font-medium daimo-text-[var(--daimo-text-secondary)]">
                Date of birth
              </span>
              <TextInput
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                onKeyDown={handleKeyDown}
                className="daimo-px-4 daimo-py-3"
              />
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
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => Promise<void>;
}) {
  return (
    <EnrollmentUpdateMessage
      title="Limit increase unavailable"
      description="This Apple Pay account is not eligible for a limit increase right now."
      error={error}
      action={
        <SecondaryButton
          onClick={() => {
            void onRetry();
          }}
        >
          {t.tryAgain}
        </SecondaryButton>
      }
    />
  );
}

function EnrollmentUpdateMessage({
  title,
  description,
  error,
  icon,
  action,
}: {
  title: string;
  description: string;
  error?: string | null;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <CenteredContent>
      {icon}
      <div className="daimo-flex daimo-max-w-[320px] daimo-flex-col daimo-gap-2 daimo-text-center">
        <h2 className="daimo-text-lg daimo-font-semibold daimo-text-[var(--daimo-text)]">
          {title}
        </h2>
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

function parseDateInput(
  value: string,
): { day: string; month: string; year: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
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
