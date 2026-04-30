import { CSSProperties, ReactNode } from "react";

import { ExternalLinkIcon } from "./icons.js";

export { ExternalLinkIcon };

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
};

/** Primary action button - full width, prominent styling */
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  icon,
  className = "",
}: ButtonProps) {
  // Base: min 44px tap target, prevent double-tap zoom
  const baseStyles =
    "daimo-w-full daimo-max-w-xs daimo-min-h-[44px] daimo-py-4 daimo-px-6 daimo-rounded-[var(--daimo-radius-lg)] daimo-font-medium daimo-flex daimo-items-center daimo-justify-center daimo-gap-2 daimo-touch-action-manipulation daimo-transition-[background-color] daimo-duration-100 daimo-ease";
  const enabledStyles =
    "daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text)] hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)]";
  const disabledStyles =
    "daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text-muted)] daimo-cursor-not-allowed";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${disabled ? disabledStyles : enabledStyles} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

/** Secondary action button - for less prominent actions like "Done", "Close" */
export function SecondaryButton({
  children,
  onClick,
  disabled = false,
  icon,
  className = "",
}: ButtonProps) {
  // Base: min 44px tap target, prevent double-tap zoom
  const baseStyles =
    "daimo-min-h-[44px] daimo-py-3 daimo-px-8 daimo-rounded-[var(--daimo-radius-md)] daimo-font-medium daimo-flex daimo-items-center daimo-justify-center daimo-gap-2 daimo-touch-action-manipulation daimo-transition-[background-color] daimo-duration-100 daimo-ease";
  const enabledStyles =
    "daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text)] hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-hover)]";
  const disabledStyles =
    "daimo-bg-[var(--daimo-surface-secondary)] daimo-text-[var(--daimo-text-muted)] daimo-cursor-not-allowed";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${disabled ? disabledStyles : enabledStyles} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

type SecondaryLinkButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** Small underlined text link. Renders <a> when href is set, <button> otherwise. */
export function SecondaryLinkButton({
  children,
  href,
  onClick,
  disabled,
  className = "",
  style,
}: SecondaryLinkButtonProps) {
  const styles = `daimo-text-sm daimo-text-[var(--daimo-text-secondary)] hover:daimo-text-[var(--daimo-text)] daimo-underline daimo-transition-colors ${className}`;

  if (href != null) {
    return (
      <a href={href} className={styles} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={styles}
      style={style}
    >
      {children}
    </button>
  );
}
