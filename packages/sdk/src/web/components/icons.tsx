type IconProps = {
  className?: string;
  size?: number;
};

/** Green checkmark icon for success states */
export function CheckIcon({ className, size = 40 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "daimo-text-[var(--daimo-success)]"}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/** Clock icon for expired/timeout states */
export function ExpiredIcon({ className, size = 40 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "daimo-text-[var(--daimo-error)]"}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/** Alert icon for error states */
export function ErrorIcon({ className, size = 40 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-error-badge-mark)]"}
    >
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.8"
        opacity="0.95"
      />
      <path
        d="M12 7.4v5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 16.55h.01"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Back arrow for navigation */
export function BackArrowIcon({ className, size = 9 }: IconProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 16) / 9)}
      viewBox="0 0 9 16"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <path
        d="M8 1L1 8L8 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Chevron icon for compact previous/next controls */
export function ChevronIcon({
  className,
  size = 16,
  direction = "right",
}: IconProps & { direction?: "left" | "right" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
      style={{ transform: direction === "left" ? "rotate(180deg)" : undefined }}
      aria-hidden="true"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Opposing arrows for switching payment modes */
export function SwitchArrowsIcon({
  className,
  size = 16,
  flipY = false,
  animated = false,
}: IconProps & { flipY?: boolean; animated?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
      style={{
        transform: flipY ? "scaleY(-1)" : "scaleY(1)",
        transition: animated ? "transform 0.2s ease-in-out" : undefined,
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
  );
}

/** Close X icon for modal dismiss */
export function CloseIcon({ className, size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <path
        d="M1 13L13 1M1 1L13 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Plus icon for additive actions */
export function PlusIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <path
        d="M9 3.25v11.5M3.25 9h11.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Standard Trash2 outline for destructive actions */
export function TrashIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Horizontal ellipsis for compact account actions */
export function EllipsisIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <path
        d="M4 14h.01M9 14h.01M14 14h.01"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Envelope for account email */
export function EmailIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <path
        d="M2.5 5c0-.97.78-1.75 1.75-1.75h9.5c.97 0 1.75.78 1.75 1.75v8c0 .97-.78 1.75-1.75 1.75h-9.5c-.97 0-1.75-.78-1.75-1.75V5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m3.35 4.8 4.9 4.1c.44.37 1.06.37 1.5 0l4.9-4.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Door arrow for signing out */
export function LogoutIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <path
        d="M7.5 3.25H4.75c-.83 0-1.5.67-1.5 1.5v8.5c0 .83.67 1.5 1.5 1.5H7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 5.25 14.75 9 11 12.75M14.25 9H7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Copy icon with checkmark state */
export function CopyIcon({
  className,
  size = 20,
  copied = false,
}: IconProps & { copied?: boolean }) {
  if (copied) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className ?? "daimo-text-[var(--daimo-accent)]"}
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

/** Daimo asterisk logo */
export function DaimoLogoIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="70 78 160 144"
      fill="none"
      className={className ?? "daimo-text-[var(--daimo-text-muted)]"}
    >
      <path
        d="M180 202L120 98"
        stroke="currentColor"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <path
        d="M210 150L90 150"
        stroke="currentColor"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <path
        d="M180 98L120 202"
        stroke="currentColor"
        strokeWidth="34"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** External link icon */
export function ExternalLinkIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 4C2.89543 4 2 4.89543 2 6V12C2 13.1046 2.89543 14 4 14H10C11.1046 14 12 13.1046 12 12V9.66667C12 9.11438 12.4477 8.66667 13 8.66667C13.5523 8.66667 14 9.11438 14 9.66667V12C14 14.2091 12.2091 16 10 16H4C1.79086 16 0 14.2091 0 12V6C0 3.79086 1.79086 2 4 2H6.33333C6.88562 2 7.33333 2.44772 7.33333 3C7.33333 3.55228 6.88562 4 6.33333 4H4Z"
        fill="currentColor"
        fillOpacity={0.4}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.5 1C9.5 0.447715 9.94772 0 10.5 0H15C15.5523 0 16 0.447715 16 1V5.5C16 6.05228 15.5523 6.5 15 6.5C14.4477 6.5 14 6.05228 14 5.5V3.41421L8.70711 8.70711C8.31658 9.09763 7.68342 9.09763 7.29289 8.70711C6.90237 8.31658 6.90237 7.68342 7.29289 7.29289L12.5858 2H10.5C9.94772 2 9.5 1.55228 9.5 1Z"
        fill="currentColor"
        fillOpacity={0.4}
      />
    </svg>
  );
}

/** YouTube logo for video walkthrough actions */
export function YouTubeLogoIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        fill="#FF0033"
        d="M21.58 7.19a2.72 2.72 0 0 0-1.91-1.93C17.98 4.8 12 4.8 12 4.8s-5.98 0-7.67.46a2.72 2.72 0 0 0-1.91 1.93A28.4 28.4 0 0 0 2 12a28.4 28.4 0 0 0 .42 4.81 2.72 2.72 0 0 0 1.91 1.93c1.69.46 7.67.46 7.67.46s5.98 0 7.67-.46a2.72 2.72 0 0 0 1.91-1.93A28.4 28.4 0 0 0 22 12a28.4 28.4 0 0 0-.42-4.81Z"
      />
      <path fill="#FFFFFF" d="m10 15.2 5.2-3.2L10 8.8v6.4Z" />
    </svg>
  );
}

/** QR-style icon for direct deposit instructions */
export function DepositInstructionsIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 5.25C4 4.56 4.56 4 5.25 4h4.5C10.44 4 11 4.56 11 5.25v4.5C11 10.44 10.44 11 9.75 11h-4.5C4.56 11 4 10.44 4 9.75v-4.5Z" />
      <path d="M4 14.25C4 13.56 4.56 13 5.25 13h4.5c.69 0 1.25.56 1.25 1.25v4.5c0 .69-.56 1.25-1.25 1.25h-4.5C4.56 20 4 19.44 4 18.75v-4.5Z" />
      <path d="M13 5.25C13 4.56 13.56 4 14.25 4h4.5c.69 0 1.25.56 1.25 1.25v4.5c0 .69-.56 1.25-1.25 1.25h-4.5C13.56 11 13 10.44 13 9.75v-4.5Z" />
      <path d="M6.75 6.75h.5" />
      <path d="M6.75 16.75h.5" />
      <path d="M15.75 6.75h.5" />
      <path d="M14 14h.5" />
      <path d="M19.5 14h.5" />
      <path d="M14 19.5h.5" />
      <path d="M19.5 19.5h.5" />
      <path d="M16.75 16.75h.5" />
    </svg>
  );
}

/** Warning triangle for critical transfer instructions */
export function WarningIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.3 4.5 2.7 17.7A2 2 0 0 0 4.4 20.7h15.2a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z" />
      <path d="M12 8.5v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}
