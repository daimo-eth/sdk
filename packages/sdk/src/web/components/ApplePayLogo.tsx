import type { CSSProperties } from "react";

import { resolveIconUrl } from "./shared.js";

const APPLE_PAY_LOGO_PATH = "/payment-logos/apple.svg";

export function isApplePayLogo(icon: string): boolean {
  return icon === APPLE_PAY_LOGO_PATH;
}

export function ApplePayLogo({
  baseUrl,
  alt,
  className,
  style,
}: {
  baseUrl: string;
  alt: string;
  className: string;
  style?: CSSProperties;
}) {
  const logoUrl = resolveIconUrl(APPLE_PAY_LOGO_PATH, baseUrl);
  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
      role={alt ? "img" : undefined}
      className={`${className} daimo-inline-block daimo-bg-[var(--daimo-text)]`}
      style={{
        ...style,
        WebkitMask: `url("${logoUrl}") center / contain no-repeat`,
        mask: `url("${logoUrl}") center / contain no-repeat`,
      }}
    />
  );
}
