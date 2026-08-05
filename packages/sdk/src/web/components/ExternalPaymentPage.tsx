import type { WaitingInstruction } from "../../common/api.js";
import { t } from "../hooks/locale.js";
import { isDesktop, type DaimoPlatform } from "../platform.js";
import { ApplePayLogo, isApplePayLogo } from "./ApplePayLogo.js";
import { BankLogo, isBankLogo } from "./BankLogo.js";
import { ExternalLinkIcon, PrimaryButton } from "./buttons.js";
import { QRCode } from "./QRCode.js";
import { SkeletonText } from "./Skeleton.js";
import {
  CenteredContent,
  PageHeader,
  PageLogo,
  resolveIconUrl,
} from "./shared.js";

type QRDensity = "short" | "medium" | "long";
type DesktopBehavior = "popup" | "qr";

type ExternalPaymentPageProps = {
  title: string;
  platform: DaimoPlatform;
  url?: string;
  icon?: string;
  message: string;
  instructions?: WaitingInstruction[];
  isLoading?: boolean;
  onBack: (() => void) | null;
  baseUrl: string;
  desktopBehavior: DesktopBehavior;
  openLabel?: string;
  popupName?: string;
  popupFeatures?: string;
  placeholderDensity?: QRDensity;
  /** Called with the opened window (null when blocked by the browser). */
  onOpened?: (popup: Window | null) => void;
};

const DEFAULT_POPUP_FEATURES = "width=500,height=700";

/** Shared handoff page for providers that complete payment outside the modal. */
export function ExternalPaymentPage({
  title,
  platform,
  url,
  icon,
  message,
  instructions,
  isLoading,
  onBack,
  baseUrl,
  desktopBehavior,
  openLabel = `${t.open} ${title}`,
  popupName,
  popupFeatures = DEFAULT_POPUP_FEATURES,
  placeholderDensity,
  onOpened,
}: ExternalPaymentPageProps) {
  const desktop = isDesktop(platform);
  const showQR = desktop && desktopBehavior === "qr";

  const openProvider = () => {
    if (!url) return;
    const popup =
      desktop && desktopBehavior === "popup"
        ? window.open(url, popupName ?? title.toLowerCase(), popupFeatures)
        : window.open(url, "_blank");
    onOpened?.(popup);
  };

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={title} onBack={onBack} />
      <CenteredContent>
        {showQR ? (
          <div className="daimo-w-full daimo-max-w-[200px] sm:daimo-max-w-[260px]">
            <QRCode
              value={url}
              placeholderDensity={placeholderDensity}
              image={
                icon && isBankLogo(icon) ? (
                  <BankLogo
                    alt={title}
                    className="daimo-w-full daimo-h-full daimo-rounded-[25%]"
                  />
                ) : icon ? (
                  <img
                    src={resolveIconUrl(icon, baseUrl)}
                    alt={title}
                    className="daimo-w-full daimo-h-full daimo-object-contain daimo-rounded-[25%]"
                  />
                ) : undefined
              }
            />
          </div>
        ) : icon && isApplePayLogo(icon) ? (
          // Masked + filled with the text color so it adapts to dark mode.
          <ApplePayLogo
            baseUrl={baseUrl}
            alt={title}
            className="daimo-w-20 daimo-h-20"
          />
        ) : icon && isBankLogo(icon) ? (
          <BankLogo
            alt={title}
            className="daimo-w-20 daimo-h-20 daimo-rounded-[25%]"
          />
        ) : (
          icon && <PageLogo icon={icon} alt={title} baseUrl={baseUrl} />
        )}
        {isLoading ? (
          <SkeletonText className="daimo-max-w-xs" widths={["80%", "60%"]} />
        ) : instructions && instructions.length > 0 ? (
          <div className="daimo-space-y-2 daimo-text-[var(--daimo-text-secondary)] daimo-text-left daimo-max-w-xs daimo-text-sm">
            {instructions.map((instruction, index) => (
              <p
                key={`${index}-${instruction.text}`}
                className="daimo-whitespace-pre-line"
              >
                {instruction.text}
                {instruction.emphasis && (
                  <strong className="daimo-block daimo-font-semibold daimo-text-[var(--daimo-text)]">
                    {instruction.emphasis}
                  </strong>
                )}
              </p>
            ))}
          </div>
        ) : (
          <p className="daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs daimo-text-sm daimo-whitespace-pre-line">
            {message}
          </p>
        )}
        {!showQR && (
          <PrimaryButton
            onClick={openProvider}
            icon={<ExternalLinkIcon />}
            disabled={!url || isLoading}
          >
            {openLabel}
          </PrimaryButton>
        )}
      </CenteredContent>
    </div>
  );
}
