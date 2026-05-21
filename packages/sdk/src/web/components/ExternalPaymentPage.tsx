import { t } from "../hooks/locale.js";
import { isDesktop, type DaimoPlatform } from "../platform.js";
import { ExternalLinkIcon, PrimaryButton } from "./buttons.js";
import { QRCode } from "./QRCode.js";
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
  isLoading?: boolean;
  onBack: () => void;
  baseUrl: string;
  desktopBehavior: DesktopBehavior;
  openLabel?: string;
  popupName?: string;
  popupFeatures?: string;
  placeholderDensity?: QRDensity;
};

const DEFAULT_POPUP_FEATURES = "width=500,height=700";

/** Shared handoff page for providers that complete payment outside the modal. */
export function ExternalPaymentPage({
  title,
  platform,
  url,
  icon,
  message,
  isLoading,
  onBack,
  baseUrl,
  desktopBehavior,
  openLabel = `${t.open} ${title}`,
  popupName,
  popupFeatures = DEFAULT_POPUP_FEATURES,
  placeholderDensity,
}: ExternalPaymentPageProps) {
  const desktop = isDesktop(platform);
  const showQR = desktop && desktopBehavior === "qr";

  const openProvider = () => {
    if (!url) return;
    if (desktop && desktopBehavior === "popup") {
      window.open(url, popupName ?? title.toLowerCase(), popupFeatures);
      return;
    }
    window.open(url, "_blank");
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
                icon ? (
                  <img
                    src={resolveIconUrl(icon, baseUrl)}
                    alt={title}
                    className="daimo-w-full daimo-h-full daimo-object-contain daimo-rounded-[25%]"
                  />
                ) : undefined
              }
            />
          </div>
        ) : (
          icon && <PageLogo icon={icon} alt={title} baseUrl={baseUrl} />
        )}
        {isLoading ? (
          <ExternalPaymentTextSkeleton />
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

function ExternalPaymentTextSkeleton() {
  return (
    <div className="daimo-flex daimo-flex-col daimo-items-center daimo-gap-2 daimo-max-w-xs daimo-w-full">
      <div className="daimo-h-4 daimo-w-4/5 daimo-rounded daimo-bg-[var(--daimo-surface-secondary)] daimo-animate-daimo-pulse" />
      <div className="daimo-h-4 daimo-w-3/5 daimo-rounded daimo-bg-[var(--daimo-surface-secondary)] daimo-animate-daimo-pulse" />
    </div>
  );
}
