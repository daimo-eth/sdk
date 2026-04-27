import { useCallback, useEffect, useState } from "react";

import type { DaimoPayToken } from "../api/walletTypes.js";
import { t } from "../hooks/locale.js";
import { isDesktop, type DaimoPlatform } from "../platform.js";
import { TokenIconWithChainBadge } from "./shared.js";

/** How to label the "native" (non-USD) side of the input. */
export type NativeDisplay =
  | { kind: "prefix"; symbol: string }   // e.g. "CA$100"
  | { kind: "suffix"; symbol: string };  // e.g. "100 JPYC"

type TokenAmountEntryProps = {
  /** Destination stablecoin. Supplies default icon, chain badge, FX rate (token.usd). */
  token: DaimoPayToken;
  /** Minimum allowed, in USD. */
  minimumUsd: number;
  /** Maximum allowed, in USD (balance-capped for wallet, server-capped for fiat). */
  maximumUsd: number;
  /** How to render the "native" side (fiat prefix or token suffix). */
  nativeDisplay: NativeDisplay;
  /** Default input mode. Wallet flow uses "usd"; fiat flow uses "native". */
  initialMode?: "usd" | "native";
  /** Initial USD amount (e.g. when resuming a session). */
  initialAmountUsd?: number;
  /** Called when the user confirms (Enter key). */
  onContinue: (amountUsd: number) => void;
  /** Called on every change. */
  onChange?: (amountUsd: number, isValid: boolean) => void;
  /**
   * Optional wallet balance. When provided, the footer shows "Balance: …"
   * instead of min/max. Min/max warnings still take priority when the user
   * exceeds bounds.
   */
  balance?: { usd: number; nativeAmountUnits: number };
  /** Show the "Max" pill. Clicking sets the input to `maximumUsd`. */
  showMax?: boolean;
  /** Override for the primary icon. Fiat flows use a country/region icon. */
  iconLogoURI?: string;
  /** Alt text for the primary icon override. */
  iconAlt?: string;
  /** Override for the token-icon badge. Null hides the badge; undefined defaults to chain badge. */
  badgeLogoURI?: string | null;
  /** Alt text for the badge override. */
  badgeAlt?: string;
  platform: DaimoPlatform;
  baseUrl: string;
};

/**
 * Unified "Enter Amount" card: token icon with chain badge, dual-mode
 * (USD ↔ native) amount input, FX swap arrow, and min/max/balance footer.
 * Used by both the wallet deposit flow and the fiat/account deposit flow.
 */
export function TokenAmountEntry({
  token,
  minimumUsd,
  maximumUsd,
  nativeDisplay,
  initialMode = "usd",
  initialAmountUsd,
  onContinue,
  onChange,
  balance,
  showMax = true,
  iconLogoURI,
  iconAlt,
  badgeLogoURI,
  badgeAlt,
  platform,
  baseUrl,
}: TokenAmountEntryProps) {
  // Swap is meaningless when the token is pegged 1:1 to USD.
  const isUsdPegged = token.fiatISO === "USD";

  const initialUsd = initialAmountUsd ?? 0;
  const initialNative = initialUsd > 0 ? usdToNativeStr(initialUsd, token) : "";

  const [usdStr, setUsdStr] = useState(
    initialUsd > 0 ? roundUsd(initialUsd) : "",
  );
  const [nativeStr, setNativeStr] = useState(initialNative);
  const [isEditingUsd, setIsEditingUsd] = useState(initialMode === "usd");

  const amountUsd = parseFloat(usdStr) || 0;
  const roundedMaxUsd = parseFloat(roundUsd(maximumUsd));
  const isValid = amountUsd >= minimumUsd && amountUsd <= roundedMaxUsd;
  const showMinWarning = usdStr !== "" && amountUsd < minimumUsd;
  const showMaxWarning = usdStr !== "" && amountUsd > roundedMaxUsd;

  useEffect(() => {
    onChange?.(amountUsd, isValid);
  }, [amountUsd, isValid, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const maxDecimals = isEditingUsd ? 2 : token.displayDecimals;
    const regex = new RegExp(`^\\d*\\.?\\d{0,${maxDecimals}}$`);
    if (value !== "" && !regex.test(value)) return;

    if (isEditingUsd) {
      const newUsd = parseFloat(value) || 0;
      setUsdStr(value);
      setNativeStr(newUsd === 0 ? "" : usdToNativeStr(newUsd, token));
    } else {
      const newNative = parseFloat(value) || 0;
      setNativeStr(value);
      setUsdStr(newNative === 0 ? "" : nativeToUsdStr(newNative, token));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isValid) onContinue(amountUsd);
  };

  const handleMax = () => {
    const maxUsdStr = roundUsd(maximumUsd);
    const maxNativeStr = usdToNativeStr(maximumUsd, token);
    setUsdStr(maxUsdStr);
    setNativeStr(maxNativeStr);
  };

  const handleSwitch = useCallback(() => {
    const nextEditingUsd = !isEditingUsd;
    // Re-format the side the user just switched away from, so it reads nicely.
    if (nextEditingUsd) {
      const nativeNum = parseFloat(nativeStr) || 0;
      const formatted = nativeNum > 0
        ? stripTrailingZeros(roundNative(nativeNum, token))
        : "";
      setNativeStr(formatted);
    } else {
      const usdNum = parseFloat(usdStr) || 0;
      setUsdStr(usdNum > 0 ? roundUsd(usdNum) : "");
    }
    setIsEditingUsd(nextEditingUsd);
  }, [isEditingUsd, nativeStr, usdStr, token]);

  const shouldAutoFocus = isDesktop(platform);
  const currentValue = isEditingUsd ? usdStr : nativeStr;
  const inputWidth =
    currentValue.length === 0
      ? "3.55ch"
      : `${Math.min(currentValue.length - (currentValue.match(/\./g) || []).length * 0.55, 10)}ch`;

  // Side decorations: $ prefix for USD mode; nativeDisplay for native mode.
  const showPrefix = isEditingUsd || nativeDisplay.kind === "prefix";
  const prefixText = isEditingUsd ? "$" : nativeDisplay.kind === "prefix" ? nativeDisplay.symbol : "";
  const showSuffix = !isEditingUsd && nativeDisplay.kind === "suffix";
  const suffixText = nativeDisplay.kind === "suffix" ? nativeDisplay.symbol : "";

  const message = buildMessage({
    showMinWarning,
    showMaxWarning,
    minimumUsd,
    maximumUsd,
    isEditingUsd,
    token,
    nativeDisplay,
    balance,
  });
  const messageColor =
    showMinWarning || showMaxWarning
      ? "daimo-text-[var(--daimo-text)]"
      : "daimo-text-[var(--daimo-text-secondary)]";

  // Secondary amount for the switch button.
  const secondaryAmount = isEditingUsd
    ? formatNative(nativeStr || "0", nativeDisplay)
    : `$${usdStr || roundUsd(0)}`;

  return (
    <div className="daimo-flex daimo-flex-col daimo-items-center">
      <div className="daimo-mb-3">
        <TokenIconWithChainBadge
          token={token}
          symbol={iconAlt}
          logoURI={iconLogoURI}
          size="lg"
          badgeLogoURI={badgeLogoURI}
          badgeAlt={badgeAlt}
          baseUrl={baseUrl}
        />
      </div>

      <div className="daimo-flex daimo-items-center daimo-justify-center daimo-gap-2">
        {/* Invisible spacer to keep the input centered when Max is shown. */}
        {showMax && (
          <span className="daimo-invisible daimo-py-[3px] daimo-px-2 daimo-text-sm">
            {t.max}
          </span>
        )}

        <div className="daimo-flex daimo-items-center daimo-justify-center daimo-gap-1">
          {showPrefix && (
            <span
              className={`daimo-text-[24px] daimo-font-semibold daimo-tabular-nums ${currentValue ? "daimo-text-[var(--daimo-text)]" : "daimo-text-[var(--daimo-placeholder)]"}`}
            >
              {prefixText}
            </span>
          )}
          <input
            type="text"
            inputMode="decimal"
            value={currentValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="0.00"
            className="daimo-bg-transparent daimo-font-semibold daimo-text-[var(--daimo-text)] daimo-placeholder-[var(--daimo-placeholder)] daimo-outline-none daimo-border-none daimo-shadow-none daimo-caret-[var(--daimo-text-muted)] daimo-tabular-nums daimo-ring-0 focus:daimo-outline-none focus:daimo-ring-0 focus:daimo-border-none focus:daimo-shadow-none"
            style={{
              width: inputWidth,
              minWidth: "1ch",
              maxWidth: "10ch",
              fontSize: "clamp(16px, 30px, 30px)",
            }}
            autoFocus={shouldAutoFocus}
          />
          {showSuffix && (
            <span className="daimo-text-base daimo-font-normal daimo-text-[var(--daimo-text-muted)]">
              {suffixText}
            </span>
          )}
        </div>

        {showMax && (
          <button
            onClick={handleMax}
            className="daimo-py-[3px] daimo-px-2 daimo-text-sm daimo-font-normal daimo-rounded-full daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text-secondary)] hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)] daimo-touch-action-manipulation daimo-transition-[background-color] daimo-duration-100 daimo-ease"
          >
            {t.max}
          </button>
        )}
      </div>

      {!isUsdPegged && (
        <SwitchButton
          onClick={handleSwitch}
          secondaryAmount={secondaryAmount}
          isEditingUsd={isEditingUsd}
        />
      )}

      <p
        className={`${messageColor} daimo-text-base daimo-font-normal daimo-leading-[21px] daimo-tabular-nums daimo-mb-6`}
      >
        {message}
      </p>
    </div>
  );
}

// --- Helpers ---

function usdToNativeStr(usd: number, token: DaimoPayToken): string {
  if (usd === 0) return "";
  return roundNative(usd / token.usd, token);
}

function nativeToUsdStr(native: number, token: DaimoPayToken): string {
  if (native === 0) return "";
  return roundUsd(native * token.usd);
}

function roundUsd(usd: number): string {
  return usd.toFixed(2);
}

function roundNative(amount: number, token: DaimoPayToken): string {
  if (amount === 0) return "0";
  return amount.toFixed(token.displayDecimals);
}

function stripTrailingZeros(val: string): string {
  return val.includes(".") ? val.replace(/\.?0+$/, "") : val;
}

function formatNative(value: string, display: NativeDisplay): string {
  return display.kind === "prefix"
    ? `${display.symbol}${value}`
    : `${value} ${display.symbol}`;
}

function buildMessage(args: {
  showMinWarning: boolean;
  showMaxWarning: boolean;
  minimumUsd: number;
  maximumUsd: number;
  isEditingUsd: boolean;
  token: DaimoPayToken;
  nativeDisplay: NativeDisplay;
  balance?: { usd: number; nativeAmountUnits: number };
}): string {
  const { showMinWarning, showMaxWarning, minimumUsd, maximumUsd, isEditingUsd, token, nativeDisplay, balance } = args;
  const fmt = (usd: number) =>
    isEditingUsd
      ? `$${roundUsd(usd)}`
      : formatNative(usdToNativeStr(usd, token), nativeDisplay);
  if (showMaxWarning) return `${t.maximum} ${fmt(maximumUsd)}`;
  if (showMinWarning) return `${t.minimum} ${fmt(minimumUsd)}`;
  if (balance) {
    if (isEditingUsd) {
      const isUsdPegged = token.fiatISO === "USD";
      return isUsdPegged
        ? `${t.balance} $${roundUsd(balance.usd)}`
        : `${t.balance} $${roundUsd(balance.usd)} ${token.symbol}`;
    }
    return `${t.balance} ${formatNative(roundNative(balance.nativeAmountUnits, token), nativeDisplay)}`;
  }
  return `${t.minimum} ${fmt(minimumUsd)}`;
}

function SwitchButton({
  onClick,
  secondaryAmount,
  isEditingUsd,
}: {
  onClick: () => void;
  secondaryAmount: string;
  isEditingUsd: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="daimo-flex daimo-items-center daimo-gap-1 daimo-py-3 daimo-px-4 hover:[@media(hover:hover)]:daimo-opacity-70 active:daimo-opacity-50 daimo-touch-action-manipulation daimo-transition-opacity daimo-duration-150 daimo-ease"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="daimo-text-[var(--daimo-text-muted)]"
        style={{
          transform: isEditingUsd ? "scaleY(1)" : "scaleY(-1)",
          transition: "transform 0.2s ease-in-out",
        }}
      >
        <path
          d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="daimo-text-base daimo-font-normal daimo-leading-[21px] daimo-text-[var(--daimo-text-secondary)] daimo-tabular-nums">
        {secondaryAmount}
      </span>
    </button>
  );
}
