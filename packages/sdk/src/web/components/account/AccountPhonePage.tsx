import { useCallback, useMemo, useRef, useState } from "react";

import { useDaimoClient } from "../../hooks/DaimoClientContext.js";
import { t } from "../../hooks/locale.js";
import { useAccountFlow } from "../../hooks/useAccountFlow.js";
import { PrimaryButton } from "../buttons.js";
import { CenteredContent, ErrorMessage, PageHeader } from "../shared.js";
import { AccountAuthErrorMessage } from "./AccountAuthErrorMessage.js";
import {
  formatUsPhoneLocal,
  normalizeUsPhoneDigits,
  normalizeUsPhoneLocalDigits,
  parseUsPhoneNumber,
} from "./phone.js";

type PhoneState =
  | { kind: "incomplete" }
  | { kind: "invalid" }
  | { kind: "valid"; e164: string };

type AccountPhonePageProps = {
  sessionId: string;
  clientSecret: string;
  onBack: () => void;
  onOtpSent: () => void;
};

/**
 * Phone entry for the semantic account-phone-verification interaction.
 */
export function AccountPhonePage({
  sessionId,
  clientSecret,
  onBack,
  onOtpSent,
}: AccountPhonePageProps) {
  const account = useAccountFlow();
  const client = useDaimoClient();
  const [phoneDigits, setPhoneDigits] = useState(() =>
    normalizeUsPhoneDigits(account?.phoneNumber ?? ""),
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  const phone = useMemo<PhoneState>(() => {
    if (phoneDigits.length < 10) return { kind: "incomplete" };
    const e164 = parseUsPhoneNumber(phoneDigits);
    return e164 ? { kind: "valid", e164 } : { kind: "invalid" };
  }, [phoneDigits]);
  const validationError =
    phone.kind === "invalid" ? t.applePayUsPhoneRequired : null;
  const formattedPhone = useMemo(
    () => formatUsPhoneLocal(phoneDigits),
    [phoneDigits],
  );

  const restoreCaret = useCallback((digitIndex: number, nextDigits: string) => {
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      const nextFormatted = formatUsPhoneLocal(nextDigits);
      const nextCaret = getCaretForDigitIndex(nextFormatted, digitIndex);
      input.setSelectionRange(nextCaret, nextCaret);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!account || phone.kind !== "valid") return;
    account.setPhoneNumber(phone.e164);
    const sent = await account.sendPhoneOtp(phone.e164, client);
    if (sent) onOtpSent();
  }, [account, client, phone, onOtpSent]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (account?.authError) account.setAuthError(null);
      const rawValue = e.target.value;
      const nextDigits = normalizeUsPhoneLocalDigits(rawValue);
      const selectionStart = e.target.selectionStart ?? rawValue.length;
      const digitIndex = Math.min(
        countDigits(rawValue.slice(0, selectionStart)),
        nextDigits.length,
      );
      setPhoneDigits(nextDigits);
      restoreCaret(digitIndex, nextDigits);
    },
    [account, restoreCaret],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && phone.kind === "valid") {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key !== "Backspace" && e.key !== "Delete") return;

      const input = e.currentTarget;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? start;
      if (start !== end) return;

      const digitIndex = countDigits(formattedPhone.slice(0, start));
      const removeIndex = e.key === "Backspace" ? digitIndex - 1 : digitIndex;
      if (removeIndex < 0 || removeIndex >= phoneDigits.length) return;

      e.preventDefault();
      if (account?.authError) account.setAuthError(null);
      const nextDigits =
        phoneDigits.slice(0, removeIndex) + phoneDigits.slice(removeIndex + 1);
      setPhoneDigits(nextDigits);
      restoreCaret(removeIndex, nextDigits);
    },
    [
      account,
      formattedPhone,
      handleSubmit,
      phone.kind,
      phoneDigits,
      restoreCaret,
    ],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (account?.authError) account.setAuthError(null);
      const nextDigits = normalizeUsPhoneDigits(
        e.clipboardData.getData("text"),
      );
      setPhoneDigits(nextDigits);
      restoreCaret(nextDigits.length, nextDigits);
    },
    [account, restoreCaret],
  );

  const handleFocus = useCallback(() => {
    restoreCaret(phoneDigits.length, phoneDigits);
  }, [phoneDigits, restoreCaret]);

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={t.accountPhone} onBack={onBack} />

      <CenteredContent>
        <p className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)] daimo-text-center">
          {t.accountPhoneDesc}
        </p>

        <div className="daimo-w-full daimo-max-w-xs daimo-flex daimo-items-center daimo-gap-3 daimo-px-4 daimo-py-3 daimo-bg-[var(--daimo-surface-secondary)] daimo-rounded-[var(--daimo-radius-md)] focus-within:daimo-ring-2 focus-within:daimo-ring-[var(--daimo-accent)] daimo-transition-shadow">
          <UsFlagIcon />
          <span className="daimo-text-base daimo-font-medium daimo-text-[var(--daimo-text-secondary)] daimo-select-none">
            +1
          </span>
          <input
            ref={inputRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={formattedPhone}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={handleFocus}
            placeholder="650 555 1234"
            aria-label={t.accountPhone}
            autoFocus
            className="daimo-flex-1 daimo-min-w-0 daimo-bg-transparent daimo-border-none daimo-outline-none daimo-shadow-none daimo-ring-0 daimo-text-base daimo-text-[var(--daimo-text)] daimo-placeholder-[var(--daimo-placeholder)] daimo-caret-[var(--daimo-accent)] focus:daimo-outline-none focus:daimo-ring-0 focus:daimo-border-none focus:daimo-shadow-none"
          />
        </div>
        {account?.authError ? (
          <AccountAuthErrorMessage
            sessionId={sessionId}
            clientSecret={clientSecret}
          />
        ) : (
          validationError && <ErrorMessage message={validationError} />
        )}
      </CenteredContent>

      <div className="daimo-px-6 daimo-pb-6 daimo-flex daimo-flex-col daimo-items-center">
        <PrimaryButton
          onClick={handleSubmit}
          disabled={phone.kind !== "valid" || account?.isLoggingIn}
        >
          {account?.isLoggingIn ? t.loading : t.continue}
        </PrimaryButton>
      </div>
    </div>
  );
}

function UsFlagIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      className="daimo-h-5 daimo-w-5 daimo-shrink-0 daimo-overflow-hidden daimo-rounded-full"
    >
      <path
        fill="#eee"
        d="M256 0h256v64l-32 32 32 32v64l-32 32 32 32v64l-32 32 32 32v64l-256 32L0 448v-64l32-32-32-32v-64z"
      />
      <path
        fill="#d80027"
        d="M224 64h288v64H224Zm0 128h288v64H256ZM0 320h512v64H0Zm0 128h512v64H0Z"
      />
      <path fill="#0052b4" d="M0 0h256v256H0Z" />
      <path
        fill="#eee"
        d="m187 243 57-41h-70l57 41-22-67zm-81 0 57-41H93l57 41-22-67zm-81 0 57-41H12l57 41-22-67zm162-81 57-41h-70l57 41-22-67zm-81 0 57-41H93l57 41-22-67zm-81 0 57-41H12l57 41-22-67Zm162-82 57-41h-70l57 41-22-67Zm-81 0 57-41H93l57 41-22-67zm-81 0 57-41H12l57 41-22-67Z"
      />
    </svg>
  );
}

function countDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

function getCaretForDigitIndex(formatted: string, digitIndex: number): number {
  if (digitIndex <= 0) return 0;
  let seenDigits = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (!/\d/.test(formatted[i])) continue;
    seenDigits += 1;
    if (seenDigits === digitIndex) return i + 1;
  }
  return formatted.length;
}
