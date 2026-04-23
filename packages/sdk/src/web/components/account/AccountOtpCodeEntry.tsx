import { useCallback, useRef, useState } from "react";

import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { PrimaryButton } from "../buttons.js";
import {
  CenteredContent,
  ErrorMessage,
  PageHeader,
} from "../shared.js";

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
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

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
          inputsRef.current[0]?.focus();
        }, ERROR_DELAY_MS);
      }
    },
    [code, busy, onVerify, onVerified, account],
  );

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value) || busy) return;
      if (account?.authError) account.setAuthError(null);
      const next = [...digits];
      next[index] = value.slice(-1);
      setDigits(next);
      if (value && index < OTP_LENGTH - 1) {
        inputsRef.current[index + 1]?.focus();
      }
      const nextCode = next.join("");
      if (nextCode.length === OTP_LENGTH) handleVerify(nextCode);
    },
    [digits, account, handleVerify, busy],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (busy) return;
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      } else if (e.key === "Enter" && isComplete) {
        e.preventDefault();
        handleVerify();
      }
    },
    [digits, isComplete, handleVerify, busy],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      if (busy) return;
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
      const next = [...digits];
      for (let i = 0; i < OTP_LENGTH && i < pasted.length; i++) {
        next[i] = pasted[i];
      }
      setDigits(next);
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      inputsRef.current[focusIdx]?.focus();
      const nextCode = next.join("");
      if (nextCode.length === OTP_LENGTH) handleVerify(nextCode);
    },
    [digits, handleVerify, busy],
  );

  const handleResend = useCallback(async () => {
    setDigits(Array(OTP_LENGTH).fill(""));
    setStatus("idle");
    await onResend();
    inputsRef.current[0]?.focus();
  }, [onResend]);

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountOtp} onBack={onBack} />

      <CenteredContent>
        <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center">
          {t.accountOtpSent} <strong>{destination}</strong>
        </p>

        <div
          className={`daimo-flex daimo-gap-2 daimo-justify-center ${status === "error" ? "daimo-otp-shake" : ""}`}
        >
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={busy}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              autoFocus={i === 0}
              className={otpCellClass(status)}
            />
          ))}
        </div>

        {account?.authError && <ErrorMessage message={account.authError} />}

        <button
          onClick={handleResend}
          disabled={busy}
          className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] hover:daimo-text-[var(--daimo-text)] daimo-underline daimo-transition-colors"
        >
          {t.accountResendCode}
        </button>
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
  "daimo-w-10 daimo-h-12 daimo-text-center daimo-text-xl daimo-font-semibold daimo-rounded-[var(--daimo-radius-sm)] daimo-border-none daimo-outline-none daimo-transition-all daimo-caret-[var(--daimo-accent)]";

function otpCellClass(status: OtpStatus): string {
  if (status === "success") {
    return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-success-light)] daimo-text-[var(--daimo-success)] daimo-ring-2 daimo-ring-[var(--daimo-success)]`;
  }
  if (status === "error") {
    return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-error-light)] daimo-text-[var(--daimo-error)] daimo-ring-2 daimo-ring-[var(--daimo-error)]`;
  }
  return `${OTP_CELL_BASE} daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text)] focus:daimo-ring-2 focus:daimo-ring-[var(--daimo-accent)]`;
}
