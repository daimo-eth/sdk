import type { CSSProperties } from "react";

const BANK_LOGO_PATH = "/payment-logos/bank.svg";

export function isBankLogo(icon: string): boolean {
  return icon === BANK_LOGO_PATH;
}

export function BankLogo({
  alt,
  className,
  style,
}: {
  alt: string;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
      role={alt ? "img" : undefined}
      className={`${className} daimo-overflow-hidden`}
      style={style}
    >
      <rect width="24" height="24" fill="var(--daimo-text)" />
      <g transform="translate(3.36 3.36) scale(0.72)">
        <path
          d="M10 18v-7M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949zM14 18v-7M18 18v-7M3 22h18M6 18v-7"
          stroke="var(--daimo-surface)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
