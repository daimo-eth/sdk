import { useCallback, useRef, useState } from "react";

import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { useResendCooldown } from "../../hooks/useResendCooldown.js";
import { PrimaryButton, SecondaryLinkButton } from "../buttons.js";
import { CenteredContent, PageHeader } from "../shared.js";
import { AccountAuthErrorMessage } from "./AccountAuthErrorMessage.js";

export type OtpVerifyOutcome = { ok: true } | { ok: false; msg?: string };

type AccountOtpCodeEntryProps = {
  destination: string;
  sessionId?: string;
  clientSecret?: string;
  title?: string;
  message?: React.ReactNode;
  consent?: React.ReactNode;
  invalidMessage?: string;
  resendDelayMs?: number;
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
  sessionId,
  clientSecret,
  title,
  message,
  consent,
  invalidMessage,
  resendDelayMs = 0,
  onBack,
  onVerified,
  onVerify,
  onResend,
}: AccountOtpCodeEntryProps) {
  const account = useAccountFlow();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { canResend, restart: restartResendCooldown } =
    useResendCooldown(resendDelayMs);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const digits = codeToDigits(code);
  const isComplete = code.length === OTP_LENGTH;
  const busy = status !== "idle" || isSubmitting || !!account?.isLoggingIn;

  const handleVerify = useCallback(
    async (codeToVerify?: string) => {
      const submitCode = codeToVerify ?? code;
      if (submitCode.length !== OTP_LENGTH || busy) return;
      setIsSubmitting(true);
      const outcome = await onVerify(submitCode).catch((err) => ({
        ok: false as const,
        msg: err instanceof Error ? err.message : undefined,
      }));
      setIsSubmitting(false);
      if (outcome.ok) {
        setStatus("success");
        window.setTimeout(() => onVerified(), SUCCESS_DELAY_MS);
      } else {
        if (outcome.msg || invalidMessage) {
          account?.setAuthError(outcome.msg ?? invalidMessage ?? null);
        }
        setStatus("error");
        window.setTimeout(() => {
          setCode("");
          setStatus("idle");
          inputRef.current?.focus();
        }, ERROR_DELAY_MS);
      }
    },
    [code, busy, onVerify, onVerified, invalidMessage, account],
  );

  const handleCodeValue = useCallback(
    (value: string) => {
      if (busy) return;
      if (account?.authError) account.setAuthError(null);
      const nextCode = normalizeOtpCode(value);
      setCode(nextCode);
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
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedCode = normalizeOtpCode(e.clipboardData.getData("text"));
      if (pastedCode.length !== OTP_LENGTH) return;
      e.preventDefault();
      handleCodeValue(pastedCode);
    },
    [handleCodeValue],
  );

  const handleResend = useCallback(async () => {
    if (!canResend || busy) return;
    setCode("");
    setStatus("idle");
    try {
      await onResend();
    } finally {
      restartResendCooldown();
      inputRef.current?.focus();
    }
  }, [busy, canResend, onResend, restartResendCooldown]);

  const focusInputEnd = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setSelectionRange(code.length, code.length);
  }, [code]);

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title ?? t.accountOtp} onBack={onBack} />

      <CenteredContent>
        <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center">
          {message ?? (
            <>
              {t.accountOtpSent} <strong>{destination}</strong>
            </>
          )}
        </p>

        <div className="daimo-relative daimo-flex daimo-justify-center daimo-rounded-[var(--daimo-radius-sm)]">
          <input
            ref={inputRef}
            type="text"
            name="one-time-code"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="one-time-code"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            pattern="[0-9]*"
            value={code}
            disabled={busy}
            aria-label={t.accountOtp}
            aria-invalid={status === "error" || !!account?.authError}
            onChange={(e) => handleCodeValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => {
              setIsFocused(true);
              focusInputEnd();
            }}
            onBlur={() => setIsFocused(false)}
            autoFocus
            className="daimo-absolute daimo-inset-0 daimo-z-10 daimo-m-0 daimo-h-full daimo-w-full daimo-appearance-none daimo-touch-manipulation daimo-rounded-[var(--daimo-radius-sm)] daimo-border-0 daimo-bg-transparent daimo-p-0 daimo-text-base daimo-text-transparent daimo-caret-transparent daimo-outline-none daimo-shadow-none daimo-cursor-text disabled:daimo-cursor-default"
          />
          <div
            aria-hidden="true"
            className={`daimo-flex daimo-gap-2 daimo-justify-center ${status === "error" ? "daimo-otp-shake" : ""}`}
          >
            {digits.map((digit, i) => (
              <div
                key={i}
                className={otpCellClass(
                  status,
                  isFocused && i === Math.min(code.length, OTP_LENGTH - 1),
                )}
              >
                {digit}
              </div>
            ))}
          </div>
        </div>

        <AccountAuthErrorMessage
          sessionId={sessionId}
          clientSecret={clientSecret}
        />

        <SecondaryLinkButton
          onClick={handleResend}
          disabled={busy || !canResend}
        >
          {t.accountResendCode}
        </SecondaryLinkButton>
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center daimo-gap-3">
        {consent}
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
  "daimo-w-10 daimo-h-12 daimo-flex daimo-items-center daimo-justify-center daimo-text-center daimo-text-xl daimo-font-semibold daimo-rounded-[var(--daimo-radius-sm)] daimo-border-none daimo-outline-none";

function otpCellClass(status: OtpStatus, isActive: boolean): string {
  if (status === "success") {
    return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-brand-green-light)] daimo-text-[var(--daimo-brand-green)] daimo-ring-2 daimo-ring-[var(--daimo-brand-green)]`;
  }
  if (status === "error") {
    return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-error-light)] daimo-text-[var(--daimo-error)] daimo-ring-2 daimo-ring-[var(--daimo-error)]`;
  }
  const focusClass = isActive
    ? " daimo-ring-2 daimo-ring-[var(--daimo-accent)]"
    : "";
  return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text)]${focusClass}`;
}

export function normalizeOtpCode(value: string): string {
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
