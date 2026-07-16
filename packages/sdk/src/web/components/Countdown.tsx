import { useEffect, useState } from "react";
import { t } from "../hooks/locale.js";

/** Countdown hook — ticks every second once expiresAt is set. */
export function useCountdown(expiresAt: number, defaultS: number) {
  const hasExpiry = expiresAt > 0;
  const [remainingS, setRemainingS] = useState(() =>
    hasExpiry ? getRemainingSeconds(expiresAt) : defaultS,
  );

  useEffect(() => {
    if (!hasExpiry) return;
    const update = () => setRemainingS(getRemainingSeconds(expiresAt));
    update();
    const interval = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [expiresAt, hasExpiry]);

  return { remainingS, isExpired: hasExpiry && remainingS === 0 };
}

/** Derive remaining time from the absolute wall clock; never extend expiry. */
export function getRemainingSeconds(
  expiresAt: number,
  nowMs = Date.now(),
): number {
  return Math.max(0, Math.floor(expiresAt - nowMs / 1000));
}

/** Above this remaining time, show whole minutes instead of mm:ss. */
const SHOW_SECONDS_BELOW_S = 5 * 60;

function formatRemaining(remainingS: number): string {
  if (remainingS > SHOW_SECONDS_BELOW_S) {
    return t.minutes(Math.floor(remainingS / 60));
  }
  const m = `${Math.floor(remainingS / 60)}`.padStart(2, "0");
  const s = `${remainingS % 60}`.padStart(2, "0");
  return `${m}:${s}`;
}

export function Countdown({
  remainingS,
  isExpired,
  totalS,
}: {
  remainingS: number;
  isExpired: boolean;
  /** Omit when the server did not provide the request's total lifetime. */
  totalS?: number;
}) {
  return (
    <div
      className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-1"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="daimo-text-sm daimo-text-[var(--daimo-text)]">
        {isExpired ? t.expired : t.expiresIn}
      </span>
      <div className="daimo-flex daimo-items-center daimo-gap-2">
        {totalS != null && (
          <CircleTimer remainingS={remainingS} totalS={totalS} />
        )}
        <span
          className="daimo-font-semibold daimo-tabular-nums"
          style={{
            color: isExpired ? "var(--daimo-error)" : "var(--daimo-text)",
          }}
        >
          {isExpired ? t.expired : formatRemaining(remainingS)}
        </span>
      </div>
    </div>
  );
}

function CircleTimer({
  remainingS,
  totalS,
}: {
  remainingS: number;
  totalS: number;
}) {
  const size = 18;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (totalS > 0 ? remainingS / totalS : 0));

  return (
    <svg
      width={size}
      height={size}
      className="daimo-transform -daimo-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--daimo-placeholder)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={remainingS > 0 ? "var(--daimo-success)" : "var(--daimo-error)"}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}
