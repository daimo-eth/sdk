import { useCallback, useRef, useState } from "react";

import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { PrimaryButton, SecondaryLinkButton } from "../buttons.js";
import { CenteredContent, ErrorMessage, PageHeader } from "../shared.js";

export type OtpVerifyOutcome = { ok: true } | { ok: false; msg?: string };

type AccountOtpCodeEntryProps = {
  destination: string;
  onBack: () => void;
  onVerified: () => void;
  onVerify: (code: string) => Promise<OtpVerifyOutcome>;
  onResend: () => Promise<void>;
};

type OtpStatus = "idle" | "success" | "error";

const OTP_LENGTH = 6;
const SUCCESS_DELAY_MS = 500;
const ERROR_DELAY_MS = 700;

export function AccountOtpCodeEntry({
  destination,
  onBack,
  onVerified,
  onVerify,
  onResend,
}: AccountOtpCodeEntryProps) {
  const account = useAccountFlow();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const code = digits.join("");
  const isComplete = code.length === OTP_LENGTH;
  const busy = status !== "idle" || isSubmitting || !!account?.isLoggingIn;

  const handleVerify = useCallback(
    async (codeToVerify?: string) => {
      const submitCode = codeToVerify ?? code;
      if (submitCode.length !== OTP_LENGTH || busy) return;
      setIsSubmitting(true);
      const outcome = await onVerify(submitCode);
      setIsSubmitting(false);
      if (outcome.ok) {
        setStatus("success");
        window.setTimeout(() => onVerified(), SUCCESS_DELAY_MS);
      } else {
        if (outcome.msg) account?.setAuthError(outcome.msg);
        setStatus("error");
        window.setTimeout(() => {
          setDigits(Array(OTP_LENGTH).fill(""));
          setStatus("idle");
          inputRef.current?.focus();
        }, ERROR_DELAY_MS);
      }
    },
    [code, busy, onVerify, onVerified, account],
  );

  const handleCodeValue = useCallback(
    (value: string) => {
      if (busy) return;
      if (account?.authError) account.setAuthError(null);
      const nextCode = normalizeOtpCode(value);
      const next = codeToDigits(nextCode);
      setDigits(next);
      if (nextCode.length === OTP_LENGTH) handleVerify(nextCode);
    },
    [account, handleVerify, busy],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (busy) return;
      if (e.key === "Enter" && isComplete) {
        e.preventDefault();
        handleVerify();
      }
    },
    [isComplete, handleVerify, busy],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      handleCodeValue(e.clipboardData.getData("text"));
    },
    [handleCodeValue],
  );

  const handleResend = useCallback(async () => {
    setDigits(Array(OTP_LENGTH).fill(""));
    setStatus("idle");
    await onResend();
    inputRef.current?.focus();
  }, [onResend]);

  const focusInputEnd = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setSelectionRange(code.length, code.length);
  }, [code]);

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountOtp} onBack={onBack} />

      <CenteredContent>
        <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center">
          {t.accountOtpSent} <strong>{destination}</strong>
        </p>

        <div className="daimo-relative daimo-flex daimo-justify-center daimo-rounded-[var(--daimo-radius-sm)] focus-within:daimo-ring-2 focus-within:daimo-ring-[var(--daimo-accent)] daimo-transition-shadow">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            value={code}
            disabled={busy}
            aria-label={t.accountOtp}
            onChange={(e) => handleCodeValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={focusInputEnd}
            autoFocus
            className="daimo-absolute daimo-inset-0 daimo-z-10 daimo-w-full daimo-h-full daimo-opacity-0 daimo-cursor-text disabled:daimo-cursor-default"
          />
          <div
            aria-hidden="true"
            className={`daimo-flex daimo-gap-2 daimo-justify-center ${status === "error" ? "daimo-otp-shake" : ""}`}
          >
            {digits.map((digit, i) => (
              <div key={i} className={otpCellClass(status)}>
                {digit}
              </div>
            ))}
          </div>
        </div>

        {account?.authError && <ErrorMessage message={account.authError} />}

        <SecondaryLinkButton onClick={handleResend} disabled={busy}>
          {t.accountResendCode}
        </SecondaryLinkButton>
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton
          onClick={() => handleVerify()}
          disabled={!isComplete || busy}
        >
          {isSubmitting || account?.isLoggingIn ? t.loading : t.accountVerify}
        </PrimaryButton>
      </div>
    </div>
  );
}

const OTP_CELL_BASE =
  "daimo-w-10 daimo-h-12 daimo-flex daimo-items-center daimo-justify-center daimo-text-center daimo-text-xl daimo-font-semibold daimo-rounded-[var(--daimo-radius-sm)] daimo-border-none daimo-outline-none daimo-transition-all daimo-caret-[var(--daimo-accent)]";

function otpCellClass(status: OtpStatus): string {
  if (status === "success") {
    return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-brand-green-light)] daimo-text-[var(--daimo-brand-green)] daimo-ring-2 daimo-ring-[var(--daimo-brand-green)]`;
  }
  if (status === "error") {
    return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-error-light)] daimo-text-[var(--daimo-error)] daimo-ring-2 daimo-ring-[var(--daimo-error)]`;
  }
  return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text)]`;
}

function normalizeOtpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

function codeToDigits(code: string): string[] {
  const digits = Array(OTP_LENGTH).fill("");
  for (let i = 0; i < OTP_LENGTH; i++) {
    const digit = code[i];
    if (digit) digits[i] = digit;
  }
  return digits;
}
