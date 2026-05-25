import type {
  NavNodeKycRequirement,
  NavNodeKycRequirementIcon,
} from "../../api/navTree.js";

export type KycRequirement = NavNodeKycRequirement;

const FALLBACK_KYC_REQUIREMENT: KycRequirement = {
  kind: "id_only",
  icon: "id_card",
  label: "Identity verification",
  rowLabel: "Verify identity",
  detailTitle: "Identity verification required",
  summary: "Identity verification is required before continuing.",
  requirements: [],
};

export function getKycRequirement(
  requirement?: NavNodeKycRequirement,
): KycRequirement {
  return requirement ?? FALLBACK_KYC_REQUIREMENT;
}

export function KycIndicator({
  requirement,
  size = "sm",
  className,
  variant = "plain",
}: {
  requirement: KycRequirement;
  size?: "sm" | "lg";
  className?: string;
  variant?: "plain" | "badge";
}) {
  const indicatorSize =
    size === "lg"
      ? "daimo-h-16 daimo-w-16 daimo-rounded-full"
      : variant === "badge"
        ? "daimo-h-5 daimo-w-5 daimo-rounded-full"
        : "daimo-h-4 daimo-w-4";
  const iconSize = size === "lg" ? 30 : variant === "badge" ? 13 : 15;
  const backgroundColor =
    variant === "badge"
      ? size === "lg"
        ? "rgba(156, 163, 175, 0.12)"
        : "var(--daimo-surface)"
      : "transparent";
  const opacityClass =
    variant === "plain"
      ? "daimo-opacity-60 hover:[@media(hover:hover)]:daimo-opacity-90 daimo-transition-opacity daimo-duration-150 daimo-ease-out"
      : "";
  const borderClass =
    variant === "badge" && size !== "lg"
      ? "daimo-border daimo-border-[var(--daimo-border)] daimo-shadow-sm"
      : "";

  return (
    <span
      role="img"
      aria-label={requirement.label}
      title={requirement.summary}
      className={`daimo-inline-flex daimo-shrink-0 daimo-items-center daimo-justify-center ${indicatorSize} ${opacityClass} ${borderClass} ${className ?? ""}`}
      style={{
        color: "var(--daimo-text-muted)",
        backgroundColor,
      }}
    >
      <KycIcon icon={requirement.icon} size={iconSize} />
    </span>
  );
}

export function KycIcon({
  icon,
  size = 18,
}: {
  icon: NavNodeKycRequirementIcon;
  size?: number;
}) {
  if (icon === "id_card") {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <path d="M7.5 9h4.5" />
        <path d="M7.5 13h3" />
        <circle cx="16" cy="10" r="1.5" />
        <path d="M13.5 15.5a3.2 3.2 0 0 1 5 0" />
      </svg>
    );
  }

  if (icon === "person") {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="7.5" r="3" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
