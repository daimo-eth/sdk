import type { NavNodeDeeplink } from "../api/navTree.js";

import { ExternalLinkIcon, PrimaryButton } from "./buttons.js";
import { t } from "../hooks/locale.js";
import { isDesktop, type DaimoPlatform } from "../platform.js";
import { ExternalPaymentPage } from "./ExternalPaymentPage.js";
import {
  CenteredContent,
  PageHeader,
  PageLogo,
  resolveIconUrl,
} from "./shared.js";
import { QRCode } from "./QRCode.js";

type DeeplinkPageProps = {
  node: NavNodeDeeplink;
  platform: DaimoPlatform;
  onBack: (() => void) | null;
  baseUrl: string;
};

/** External deeplink page. Opens on mobile and hands off by QR or popup on desktop. */
export function DeeplinkPage({
  node,
  platform,
  onBack,
  baseUrl,
}: DeeplinkPageProps) {
  const desktop = isDesktop(platform);
  const pageIcon = node.pageIcon ?? node.icon;
  const desktopBehavior =
    node.desktopBehavior ?? (node.id === "RevolutRamp" ? "popup" : "qr");

  if (desktop && desktopBehavior === "popup") {
    return (
      <ExternalPaymentPage
        title={node.title}
        platform={platform}
        url={node.url}
        icon={node.icon}
        message={`${t.continueTo} ${node.title} ${t.toCompleteYourDeposit}`}
        onBack={onBack}
        baseUrl={baseUrl}
        desktopBehavior="popup"
        popupName={node.id.toLowerCase()}
      />
    );
  }

  if (desktop) {
    return (
      <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
        <PageHeader title={node.title} onBack={onBack ?? undefined} />
        <CenteredContent>
          <div className="daimo-w-full daimo-max-w-[200px] sm:daimo-max-w-[260px]">
            <QRCode
              value={node.url}
              variant={pageIcon ? "styled" : "compact"}
              image={
                pageIcon ? (
                  <img
                    src={resolveIconUrl(pageIcon, baseUrl)}
                    alt={node.title}
                    className="daimo-w-full daimo-h-full daimo-object-contain daimo-rounded-[25%]"
                  />
                ) : undefined
              }
            />
          </div>
          <p className="daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs daimo-text-sm">
            {t.scanWithPhone}
          </p>
        </CenteredContent>
      </div>
    );
  }

  const openDeeplink = () => {
    if (node.url) {
      window.open(node.url, "_blank");
    }
  };

  return (
    <div className="daimo-flex daimo-flex-col daimo-flex-1 daimo-min-h-0">
      <PageHeader title={node.title} onBack={onBack ?? undefined} />
      <CenteredContent>
        {pageIcon && (
          <PageLogo icon={pageIcon} alt={node.title} baseUrl={baseUrl} />
        )}
        <p className="daimo-text-[var(--daimo-text-secondary)] daimo-text-center daimo-max-w-xs">
          {t.continueIn} {node.title} {t.toCompleteYourPayment}
        </p>
        <PrimaryButton onClick={openDeeplink} icon={<ExternalLinkIcon />}>
          {t.openIn} {node.title}
        </PrimaryButton>
      </CenteredContent>
    </div>
  );
}
