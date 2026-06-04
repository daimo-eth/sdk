import type { ReactNode } from "react";
import { TokenLogo } from "../../common/token.js";
import type { DaimoModalTheme } from "../theme.js";
import type { DaimoModalThemeModeName } from "../theme.js";
import { daimoModalThemeToCssVars } from "../theme.js";
import type { NavNodeChooseOption } from "../api/navTree.js";
import { ChooseOptionPage } from "./ChooseOptionPage.js";
import { MODAL_CONTENT_CLASS } from "./containers.js";
import { CheckIcon, CloseIcon, DaimoLogoIcon, ErrorIcon } from "./icons.js";
import { QRCode } from "./QRCode.js";
import { Skeleton } from "./Skeleton.js";

export type DaimoModalPreviewProps = {
  theme: DaimoModalTheme;
  mode?: DaimoModalThemeModeName;
  variant?: DaimoModalPreviewVariant;
  baseUrl?: string;
};

export type DaimoModalPreviewVariant = "options" | "loading" | "semantic" | "qr";

const PREVIEW_NODE: NavNodeChooseOption = {
  type: "ChooseOption",
  id: "preview-root",
  title: "Pay $25.00",
  options: [
    {
      type: "ConnectedWallet",
      id: "preview-wallet",
      title: "Wallet",
      icons: [
        "/wallet-logos/metamask-logo.svg",
        "/wallet-logos/rainbow-logo.svg",
        "/wallet-logos/phantom-logo.svg",
        "/chain-logos/base.svg",
      ],
    },
    {
      type: "DepositAddress",
      id: "preview-deposit-address",
      title: "Deposit address",
      icons: [TokenLogo.USDC, TokenLogo.USDT],
      address: "0x1111111111111111111111111111111111111111",
      chainId: 8453,
      minimumUsd: 1,
      maximumUsd: 10000,
      expiresAt: 0,
      tokenSuffix: "USDC",
    },
    {
      type: "Exchange",
      id: "preview-coinbase",
      title: "Coinbase",
      exchangeId: "Coinbase",
      icon: "/exchange-logos/coinbase-logo.svg",
      minimumUsd: 1,
      maximumUsd: 10000,
    },
    {
      type: "Fiat",
      id: "preview-apple-pay",
      title: "Apple Pay",
      fiatMethod: "apple_pay",
      icon: "/payment-logos/apple.svg",
      kycRequirement: {
        kind: "phone",
        icon: "shield",
        label: "Phone verification",
        rowLabel: "Verify phone ~1 min",
        detailTitle: "Verify your phone",
        summary: "Phone verification is required before using Apple Pay.",
        requirements: [{ id: "phone_number", label: "Phone number" }],
        estimatedTime: "~1 min",
      },
    },
  ],
};

export function DaimoModalPreview({
  theme,
  mode = "light",
  variant = "options",
  baseUrl = "",
}: DaimoModalPreviewProps) {
  return (
    <div
      style={daimoModalThemeToCssVars(theme, mode)}
      className="daimo-mt-5 daimo-flex daimo-min-h-[520px] daimo-items-center daimo-justify-center daimo-overflow-hidden daimo-rounded-lg daimo-border daimo-border-[var(--daimo-border)] daimo-bg-[var(--daimo-bg)] daimo-p-6"
    >
      <div className={MODAL_CONTENT_CLASS}>
        <button
          type="button"
          aria-label="Close preview"
          className="daimo-absolute daimo-right-[17px] daimo-top-[22px] daimo-z-20 daimo-w-8 daimo-h-8 daimo-flex daimo-items-center daimo-justify-center daimo-rounded-full daimo-bg-[var(--daimo-surface)] hover:[@media(hover:hover)]:daimo-bg-[var(--daimo-surface-secondary)] active:daimo-scale-[0.9] daimo-transition-[background-color,transform] daimo-[transition-duration:200ms,100ms] daimo-ease daimo-touch-action-manipulation"
        >
          <CloseIcon />
        </button>
        <PreviewContent variant={variant} baseUrl={baseUrl} />
      </div>
    </div>
  );
}

function PreviewContent({
  variant,
  baseUrl,
}: {
  variant: DaimoModalPreviewVariant;
  baseUrl: string;
}) {
  switch (variant) {
    case "options":
      return (
        <ChooseOptionPage
          node={PREVIEW_NODE}
          onNavigate={() => {}}
          onBack={null}
          baseUrl={baseUrl}
        />
      );
    case "loading":
      return <LoadingPreview />;
    case "semantic":
      return <SemanticPreview />;
    case "qr":
      return <QrPreview />;
  }
}

function LoadingPreview() {
  return (
    <div className="daimo-flex daimo-min-h-[420px] daimo-flex-1 daimo-flex-col daimo-px-6 daimo-py-5">
      <div className="daimo-flex daimo-h-10 daimo-items-center daimo-justify-center">
        <Skeleton className="daimo-h-5 daimo-w-32" rounded="sm" />
      </div>
      <div className="daimo-mt-8 daimo-flex daimo-flex-col daimo-gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="daimo-h-16 daimo-w-full"
            rounded="lg"
            delayMs={i * 100}
          />
        ))}
      </div>
    </div>
  );
}

function SemanticPreview() {
  return (
    <div className="daimo-flex daimo-min-h-[420px] daimo-flex-1 daimo-flex-col daimo-px-6 daimo-py-5">
      <h1 className="daimo-text-center daimo-text-lg daimo-font-semibold daimo-text-[var(--daimo-title)]">
        Payment states
      </h1>
      <div className="daimo-mt-6 daimo-grid daimo-gap-3">
        <StateRow
          label="Completed"
          description="Funds delivered"
          bg="var(--daimo-success-light)"
          border="var(--daimo-success)"
          icon={
            <CheckIcon
              className="daimo-text-[var(--daimo-checkmark)]"
              size={22}
            />
          }
        />
        <StateRow
          label="Processing"
          description="Payment received"
          bg="var(--daimo-warning-light)"
          border="var(--daimo-warning)"
          icon={<StatusDot color="var(--daimo-warning)" />}
        />
        <StateRow
          label="Failed"
          description="Payment blocked"
          bg="var(--daimo-error-light)"
          border="var(--daimo-error)"
          icon={
            <span
              className="daimo-flex daimo-h-8 daimo-w-8 daimo-items-center daimo-justify-center daimo-rounded-full"
              style={{
                backgroundColor: "var(--daimo-error-badge-bg)",
                boxShadow: "inset 0 0 0 1px var(--daimo-error-badge-ring)",
              }}
            >
              <ErrorIcon size={20} />
            </span>
          }
        />
      </div>
      <div className="daimo-mt-6 daimo-rounded-[var(--daimo-radius-lg)] daimo-border daimo-border-[var(--daimo-accent)] daimo-p-4">
        <div className="daimo-text-sm daimo-font-semibold daimo-text-[var(--daimo-text)]">
          Checkout progress
        </div>
        <div className="daimo-mt-3 daimo-h-2 daimo-overflow-hidden daimo-rounded-full daimo-bg-[var(--daimo-surface-secondary)]">
          <div className="daimo-h-full daimo-w-2/3 daimo-rounded-full daimo-bg-[var(--daimo-accent)]" />
        </div>
      </div>
    </div>
  );
}

function StateRow({
  label,
  description,
  bg,
  border,
  icon,
}: {
  label: string;
  description: string;
  bg: string;
  border: string;
  icon: ReactNode;
}) {
  return (
    <div
      className="daimo-flex daimo-min-h-[72px] daimo-items-center daimo-gap-3 daimo-rounded-[var(--daimo-radius-lg)] daimo-p-3"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <div className="daimo-flex daimo-h-10 daimo-w-10 daimo-shrink-0 daimo-items-center daimo-justify-center">
        {icon}
      </div>
      <div className="daimo-min-w-0">
        <div className="daimo-text-sm daimo-font-semibold daimo-text-[var(--daimo-text)]">
          {label}
        </div>
        <div className="daimo-text-sm daimo-text-[var(--daimo-text-secondary)]">
          {description}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="daimo-block daimo-h-4 daimo-w-4 daimo-rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function QrPreview() {
  return (
    <div className="daimo-flex daimo-min-h-[420px] daimo-flex-1 daimo-flex-col daimo-items-center daimo-justify-center daimo-px-6 daimo-py-5">
      <h1 className="daimo-text-center daimo-text-lg daimo-font-semibold daimo-text-[var(--daimo-title)]">
        Scan to pay
      </h1>
      <p className="daimo-mt-1 daimo-text-center daimo-text-sm daimo-text-[var(--daimo-text-secondary)]">
        Open your wallet and scan this code.
      </p>
      <div className="daimo-mt-6 daimo-w-full daimo-max-w-[260px]">
        <QRCode
          value="https://daimo.com/deposit?session=preview-theme"
          image={
            <DaimoLogoIcon
              className="daimo-text-[var(--daimo-qr-dot)]"
              size={48}
            />
          }
        />
      </div>
    </div>
  );
}
