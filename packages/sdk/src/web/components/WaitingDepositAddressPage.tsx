import type { NavNodeDepositAddress } from "../api/navTree.js";
import { TokenLogo } from "../../common/token.js";
import { tron } from "../../common/chain.js";
import { useMemo, useState } from "react";
import { getAddress } from "viem";

import { SecondaryButton } from "./buttons.js";
import { Countdown, useCountdown } from "./Countdown.js";
import { useDaimoClient } from "../hooks/DaimoClientContext.js";
import { t } from "../hooks/locale.js";
import { createNavLogger } from "../hooks/navEvent.js";
import { QRCode } from "./QRCode.js";
import {
  CopyableInfoCard,
  PageHeader,
  resolveIconUrl,
  TokenIconWithChainBadge,
} from "./shared.js";

type DepositToken = "USDC" | "USDT";

const depositTokenLogos: Record<DepositToken, string> = {
  USDC: TokenLogo.USDC,
  USDT: TokenLogo.USDT,
};

/** 1 hour in seconds — standard DA address lifetime */
const DA_LIFETIME_S = 3600;

type WaitingDepositAddressPageProps = {
  node: NavNodeDepositAddress;
  amountUsd: number;
  selectedToken?: DepositToken;
  sessionId: string;
  clientSecret?: string;
  loading?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  baseUrl: string;
};

type DepositAddressContentProps = {
  address: string;
  addressLabel: string;
  amount: string;
  tokenSuffix: string;
  chainId: number;
  title: string;
  icon: DepositAddressIcon;
  expiry: DepositAddressExpiry;
  loading: boolean;
  onCopyAddress?: (value: string) => void;
  onQRToggle?: (visible: boolean) => void;
  baseUrl: string;
};

type DepositAddressIcon =
  | { kind: "selected-token"; token: DepositToken }
  | { kind: "token"; symbol: string; logoURI: string }
  | { kind: "image"; src: string; alt: string }
  | { kind: "none" };

type DepositAddressExpiry =
  | { kind: "refresh"; expiresAt: number; onRefresh: () => void }
  | { kind: "countdown"; expiresAt: number }
  | { kind: "none" };

export function WaitingDepositAddressPage({
  node,
  amountUsd,
  selectedToken,
  sessionId,
  clientSecret = "",
  loading = false,
  onBack,
  onRefresh,
  baseUrl,
}: WaitingDepositAddressPageProps) {
  const client = useDaimoClient();
  const logNavEvent = useMemo(() => createNavLogger(client), [client]);

  const hasAddress = !loading && !!node.address;
  const address = hasAddress
    ? normalizeAddress(node.address, node.chainId)
    : "";
  const tokenSuffix = selectedToken ?? node.tokenSuffix ?? "USDT or USDC";
  const nodeCtx = { nodeId: node.id, nodeType: node.type };

  const handleCopyAddress = (value: string) => {
    logNavEvent(sessionId, clientSecret, {
      ...nodeCtx,
      action: "copy_address",
      address: value,
    });
  };

  const pageTitle = selectedToken
    ? `${t.deposit} ${selectedToken}`
    : `${t.depositOn} ${node.title}`;

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={pageTitle} onBack={onBack} />

      <DepositAddressContent
        address={address}
        addressLabel={t.oneTimeAddress}
        amount={amountUsd.toFixed(2)}
        tokenSuffix={tokenSuffix}
        chainId={node.chainId}
        title={node.title}
        icon={getDepositAddressIcon(node, selectedToken)}
        expiry={{
          kind: "refresh",
          expiresAt: node.expiresAt,
          onRefresh,
        }}
        loading={loading}
        onCopyAddress={handleCopyAddress}
        onQRToggle={(visible) =>
          logNavEvent(sessionId, clientSecret, {
            ...nodeCtx,
            action: "qr_toggle",
            visible,
          })
        }
        baseUrl={baseUrl}
      />
    </div>
  );
}

export function DepositAddressContent({
  address,
  addressLabel,
  amount,
  tokenSuffix,
  chainId,
  title,
  icon,
  expiry,
  loading,
  onCopyAddress,
  onQRToggle,
  baseUrl,
}: DepositAddressContentProps) {
  const hasAddress = !loading && !!address;
  const shortAddress = hasAddress ? shortenAddress(address) : "";
  const [showQR, setShowQR] = useState(false);
  const expiresAt = expiry.kind === "none" ? 0 : expiry.expiresAt;
  const { remainingS, isExpired } = useCountdown(expiresAt, DA_LIFETIME_S);
  const disableCopy = expiry.kind === "refresh" && isExpired;

  const handleQRToggle = () => {
    if (!hasAddress) return;
    setShowQR((visible) => {
      onQRToggle?.(!visible);
      return !visible;
    });
  };

  return (
    <div className="daimo-flex-1 daimo-flex daimo-flex-col daimo-items-center daimo-p-6 daimo-gap-6">
      {disableCopy ? (
        <div className="daimo-h-24 daimo-flex daimo-items-center daimo-justify-center">
          <SecondaryButton onClick={expiry.onRefresh}>
            {t.generateNewAddress}
          </SecondaryButton>
        </div>
      ) : (
        <LogoOrQR
          showQR={showQR}
          address={address}
          chainId={chainId}
          title={title}
          icon={icon}
          baseUrl={baseUrl}
        />
      )}

      {!disableCopy && hasAddress && (
        <QRToggleButton showQR={showQR} onToggle={handleQRToggle} />
      )}

      <div className="daimo-w-full daimo-max-w-sm daimo-space-y-3">
        {hasAddress ? (
          <CopyableInfoCard
            label={addressLabel}
            value={address}
            displayValue={shortAddress}
            disabled={disableCopy}
            onCopy={onCopyAddress}
          />
        ) : (
          <AddressSkeleton />
        )}
        <CopyableInfoCard
          label={t.amount}
          value={amount}
          suffix={tokenSuffix}
          disabled={disableCopy}
        />
      </div>

      {expiry.kind !== "none" && (
        <Countdown
          remainingS={remainingS}
          isExpired={isExpired}
          totalS={DA_LIFETIME_S}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

/** Token icon (large) or QR code with token icon in center. Animated crossfade. */
function LogoOrQR({
  showQR,
  address,
  chainId,
  title,
  icon,
  baseUrl,
}: {
  showQR: boolean;
  address: string;
  chainId: number;
  title: string;
  icon: DepositAddressIcon;
  baseUrl: string;
}) {
  return (
    <div className="daimo-relative daimo-w-full daimo-flex daimo-items-center daimo-justify-center">
      {/* Spacer — grows to QR height when toggled */}
      <div
        className="daimo-w-full daimo-max-w-[200px] sm:daimo-max-w-[260px] daimo-transition-qr-spacer"
        style={{ height: showQR ? "226px" : "96px" }}
      />

      {/* QR code — fades in */}
      <div
        className="daimo-absolute daimo-inset-0 daimo-flex daimo-items-center daimo-justify-center daimo-transition-qr"
        style={{
          opacity: showQR ? 1 : 0,
          transform: showQR ? "scale(1)" : "scale(0.96)",
          pointerEvents: showQR ? "auto" : "none",
        }}
      >
        <div className="daimo-w-full daimo-max-w-[200px] sm:daimo-max-w-[260px]">
          <QRCode
            value={address}
            image={
              <TokenIcon
                chainId={chainId}
                title={title}
                icon={icon}
                size="qr"
                baseUrl={baseUrl}
              />
            }
          />
        </div>
      </div>

      {/* Large token icon — fades out when QR opens */}
      <div className="daimo-absolute daimo-inset-0 daimo-flex daimo-items-center daimo-justify-center daimo-pointer-events-none">
        <div
          className="daimo-transition-qr-icon"
          style={{
            transform: showQR ? "scale(0.6)" : "scale(1)",
            opacity: showQR ? 0 : 1,
          }}
        >
          <TokenIcon
            chainId={chainId}
            title={title}
            icon={icon}
            size="lg"
            baseUrl={baseUrl}
          />
        </div>
      </div>
    </div>
  );
}

/** Token icon at the given size, with chain badge. */
function TokenIcon({
  chainId,
  title,
  icon,
  size,
  baseUrl,
}: {
  chainId: number;
  title: string;
  icon: DepositAddressIcon;
  size: "lg" | "qr";
  baseUrl: string;
}) {
  switch (icon.kind) {
    case "selected-token":
      return (
        <TokenIconWithChainBadge
          chainId={chainId}
          symbol={icon.token}
          logoURI={depositTokenLogos[icon.token]}
          size={size}
          baseUrl={baseUrl}
          badgeBorderClass={getBadgeBorderClass(size)}
        />
      );
    case "token":
      return (
        <TokenIconWithChainBadge
          chainId={chainId}
          symbol={icon.symbol}
          logoURI={icon.logoURI}
          size={size}
          baseUrl={baseUrl}
          badgeBorderClass={getBadgeBorderClass(size)}
        />
      );
    case "image": {
      const iconSize =
        size === "qr" ? "daimo-w-12 daimo-h-12" : "daimo-w-20 daimo-h-20";
      return (
        <img
          src={resolveIconUrl(icon.src, baseUrl)}
          alt={icon.alt || title}
          className={`${iconSize} daimo-rounded-full`}
        />
      );
    }
    case "none":
      return null;
  }
}

function QRToggleButton({
  showQR,
  onToggle,
}: {
  showQR: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="daimo-flex daimo-items-center daimo-gap-2 daimo-text-[var(--daimo-text-secondary)] daimo-min-h-[44px] daimo-touch-action-manipulation"
      aria-label={showQR ? t.hideQR : t.showQR}
    >
      <span className="daimo-text-sm">{showQR ? t.hideQR : t.showQR}</span>
      <QRIcon />
    </button>
  );
}

function AddressSkeleton() {
  return (
    <div className="daimo-w-full daimo-min-h-[56px] daimo-p-4 daimo-bg-[var(--daimo-surface-secondary)] daimo-rounded-[var(--daimo-radius-sm)] daimo-flex daimo-flex-col daimo-gap-2">
      <div
        className="daimo-h-3 daimo-w-24 daimo-rounded daimo-animate-daimo-pulse"
        style={{ backgroundColor: "var(--daimo-skeleton)" }}
      />
      <div
        className="daimo-h-5 daimo-w-40 daimo-rounded daimo-animate-daimo-pulse"
        style={{
          backgroundColor: "var(--daimo-skeleton)",
          animationDelay: "100ms",
        }}
      />
    </div>
  );
}

function QRIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5Z" />
      <path d="M3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
      <path d="M13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
      <path d="M6.75 6.75h.75v.75h-.75v-.75Z" />
      <path d="M6.75 16.5h.75v.75h-.75v-.75Z" />
      <path d="M16.5 6.75h.75v.75h-.75v-.75Z" />
      <path d="M13.5 13.5h.75v.75h-.75v-.75Z" />
      <path d="M13.5 19.5h.75v.75h-.75v-.75Z" />
      <path d="M19.5 13.5h.75v.75h-.75v-.75Z" />
      <path d="M19.5 19.5h.75v.75h-.75v-.75Z" />
      <path d="M16.5 16.5h.75v.75h-.75v-.75Z" />
    </svg>
  );
}

// --- Helpers ---

function normalizeAddress(addr: string, chainId: number): string {
  if (chainId === tron.chainId) return addr;
  return getAddress(addr);
}

function getDepositAddressIcon(
  node: NavNodeDepositAddress,
  selectedToken: DepositToken | undefined,
): DepositAddressIcon {
  if (selectedToken) return { kind: "selected-token", token: selectedToken };
  if (node.icon) return { kind: "image", src: node.icon, alt: node.title };
  return { kind: "none" };
}

function getBadgeBorderClass(size: "lg" | "qr") {
  return size === "qr"
    ? "daimo-border-[1.5px] daimo-bg-[var(--daimo-qr-bg,white)] daimo-border-[var(--daimo-qr-bg,white)]"
    : "daimo-border-2 daimo-bg-[var(--daimo-surface)] daimo-border-[var(--daimo-surface)]";
}

function shortenAddress(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
